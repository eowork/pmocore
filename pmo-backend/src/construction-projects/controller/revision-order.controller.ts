import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  JwtAuthGuard,
  ModuleAccessGuard,
  RequireModule,
  Roles,
  RolesGuard,
} from '../../auth';
import { RevisionOrderService } from '../service/revision-order.service';
import { CreateRevisionOrderDto, UpdateRevisionOrderDto } from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Revision Orders')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class RevisionOrderController {
  constructor(private readonly service: RevisionOrderService) {}

  @Get(':id/revision-orders')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List revision orders for the project' })
  findRevisionOrders(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findRevisionOrders(id);
  }

  @Post(':id/revision-orders')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create revision order (auto-incremented number)' })
  createRevisionOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRevisionOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createRevisionOrder(id, dto, user);
  }

  @Patch(':id/revision-orders/:roId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update revision order' })
  updateRevisionOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roId', ParseUUIDPipe) roId: string,
    @Body() dto: UpdateRevisionOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateRevisionOrder(id, roId, dto, user);
  }

  @Delete(':id/revision-orders/:roId')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete revision order' })
  removeRevisionOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roId', ParseUUIDPipe) roId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeRevisionOrder(id, roId, user);
  }
}

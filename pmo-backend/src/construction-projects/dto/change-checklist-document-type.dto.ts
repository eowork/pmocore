import { IsUUID } from 'class-validator';

export class ChangeChecklistDocumentTypeDto {
  @IsUUID()
  documentTypeId!: string;
}

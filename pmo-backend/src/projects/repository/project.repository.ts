import { EntityRepository } from '@mikro-orm/core';
import { Project } from '../../database/entities';

export class ProjectRepository extends EntityRepository<Project> {}
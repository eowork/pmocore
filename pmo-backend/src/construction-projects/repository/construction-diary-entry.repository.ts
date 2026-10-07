import { EntityRepository, QueryOrder } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { ConstructionDiaryEntry } from '../../database/entities/construction-diary-entry.entity';

/** A diary entry as the API returns it: the row's own columns plus the author's name. */
export interface DiaryEntryRow {
  id: string;
  project_id: string;
  entry_date: string | null;
  title: string | null;
  content: string | null;
  author_id: string | null;
  created_at: Date;
  updated_at: Date;
  author_name: string | null;
}

export class ConstructionDiaryEntryRepository extends EntityRepository<ConstructionDiaryEntry> {
  /**
   * A project's diary, newest entry first.
   *
   * The join to users is a populated relation — see the entity — and it is optional, so an
   * entry whose author is unknown still comes back, which is what the LEFT JOIN was for.
   */
  async findForProject(projectId: string): Promise<DiaryEntryRow[]> {
    const entries = await this.find(
      { projectId },
      {
        populate: ['author'],
        // filters: false — User carries a default 'notDeleted' filter, which would blank the
        // name once that account is retired. A diary entry should keep the name it was
        // written under.
        filters: false,
        orderBy: { entryDate: QueryOrder.DESC, createdAt: QueryOrder.DESC },
      },
    );

    return entries.map((e) => ({
      id: e.id,
      project_id: e.projectId,
      entry_date: dateOnly(e.entryDate),
      title: e.title ?? null,
      content: e.content ?? null,
      author_id: e.authorId ?? null,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      author_name: e.author ? `${e.author.firstName} ${e.author.lastName}` : null,
    }));
  }
}

/**
 * Render a DATE column as the plain YYYY-MM-DD the raw statement returned.
 *
 * The ORM hydrates a DATE into a Date, which would serialise as a full UTC instant and shift
 * the calendar day for anyone east or west of UTC. An entry date is a calendar day.
 */
function dateOnly(value?: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

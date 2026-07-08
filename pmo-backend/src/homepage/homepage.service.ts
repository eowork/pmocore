import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { HomepageSetting, HomepageItem, Media } from '../database/entities';
import {
  UpdateHomepageSettingDto,
  CreateHomepageItemDto,
  UpdateHomepageItemDto,
  ReorderHomepageItemsDto,
} from './dto';

// T-HOME-CMS (THC-3/THC-4): homepage content — admin CRUD + public aggregate read.
@Injectable()
export class HomepageService {
  private readonly logger = new Logger(HomepageService.name);

  constructor(
    @InjectRepository(HomepageSetting)
    private readonly settingsRepo: EntityRepository<HomepageSetting>,
    @InjectRepository(HomepageItem)
    private readonly itemsRepo: EntityRepository<HomepageItem>,
    private readonly em: EntityManager,
  ) {}

  // ---- Settings (singleton copy) ----
  // T-HOME-CMS-4 (TH4-5): pageKey defaults to 'home' everywhere — existing
  // callers (which never pass it) keep working identically.

  async findAllSettings(pageKey = 'home'): Promise<HomepageSetting[]> {
    return this.settingsRepo.findAll({
      where: { pageKey },
      orderBy: { settingKey: 'asc' },
    });
  }

  async updateSetting(
    key: string,
    dto: UpdateHomepageSettingDto,
    userId: string,
    pageKey = 'home',
  ): Promise<HomepageSetting> {
    const setting = await this.settingsRepo.findOne({ settingKey: key, pageKey });
    if (!setting) {
      throw new NotFoundException(`Homepage setting '${key}' not found`);
    }
    setting.settingValue = dto.setting_value;
    setting.updatedBy = userId;
    await this.em.flush();
    this.logger.log(`HOMEPAGE_SETTING_UPDATED: key=${key}, by=${userId}`);
    return setting;
  }

  // ---- Items (ordered, publishable content) ----

  async findAllItems(sectionKey?: string, pageKey = 'home'): Promise<HomepageItem[]> {
    const where = sectionKey ? { sectionKey, pageKey } : { pageKey };
    return this.itemsRepo.find(where, {
      orderBy: { sectionKey: 'asc', itemOrder: 'asc', createdAt: 'asc' },
    });
  }

  async findOneItem(id: string): Promise<HomepageItem> {
    const item = await this.itemsRepo.findOne({ id });
    if (!item) {
      throw new NotFoundException(`Homepage item ${id} not found`);
    }
    return item;
  }

  async createItem(
    dto: CreateHomepageItemDto,
    userId: string,
  ): Promise<HomepageItem> {
    // Default to end-of-section when no explicit order is given.
    let order = dto.item_order;
    if (order === undefined) {
      const last = await this.itemsRepo.find(
        { sectionKey: dto.section_key },
        { orderBy: { itemOrder: 'desc' }, limit: 1 },
      );
      order = last.length ? last[0].itemOrder + 1 : 1;
    }

    const item = this.itemsRepo.create({
      sectionKey: dto.section_key,
      pageKey: 'home',
      itemOrder: order,
      title: dto.title,
      body: dto.body,
      icon: dto.icon,
      linkUrl: dto.link_url,
      valueSource: dto.value_source,
      manualValue: dto.manual_value,
      mediaId: dto.media_id,
      isPublished: dto.is_published ?? true,
      isPinned: dto.is_pinned ?? false,
      scheduledStart: dto.scheduled_start ? new Date(dto.scheduled_start) : undefined,
      scheduledEnd: dto.scheduled_end ? new Date(dto.scheduled_end) : undefined,
      colorToken: dto.color_token || undefined,
      linkedProjectId: dto.linked_project_id || undefined,
      subtitle: dto.subtitle,
      fullDescription: dto.full_description,
      author: dto.author,
      department: dto.department,
      publishDate: dto.publish_date ? new Date(dto.publish_date) : undefined,
      isFeatured: dto.is_featured ?? false,
      statusText: dto.status_text,
      campusText: dto.campus_text,
      budgetText: dto.budget_text,
      completionText: dto.completion_text,
      createdBy: userId,
    });
    await this.em.persist(item).flush();
    this.logger.log(
      `HOMEPAGE_ITEM_CREATED: id=${item.id}, section=${item.sectionKey}, by=${userId}`,
    );
    return item;
  }

  async updateItem(
    id: string,
    dto: UpdateHomepageItemDto,
    userId: string,
  ): Promise<HomepageItem> {
    const item = await this.findOneItem(id);

    if (dto.item_order !== undefined) item.itemOrder = dto.item_order;
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.body !== undefined) item.body = dto.body;
    if (dto.icon !== undefined) item.icon = dto.icon;
    if (dto.link_url !== undefined) item.linkUrl = dto.link_url;
    if (dto.value_source !== undefined) item.valueSource = dto.value_source;
    if (dto.manual_value !== undefined) item.manualValue = dto.manual_value;
    if (dto.media_id !== undefined) item.mediaId = dto.media_id;
    if (dto.is_published !== undefined) item.isPublished = dto.is_published;
    if (dto.is_pinned !== undefined) item.isPinned = dto.is_pinned;
    // Empty string clears the color back to the default accent (TH5-11).
    if (dto.color_token !== undefined) item.colorToken = dto.color_token || undefined;
    if (dto.linked_project_id !== undefined) item.linkedProjectId = dto.linked_project_id || undefined;
    if (dto.subtitle !== undefined) item.subtitle = dto.subtitle;
    if (dto.full_description !== undefined) item.fullDescription = dto.full_description;
    if (dto.author !== undefined) item.author = dto.author;
    if (dto.department !== undefined) item.department = dto.department;
    if (dto.publish_date !== undefined) {
      item.publishDate = dto.publish_date ? new Date(dto.publish_date) : undefined;
    }
    if (dto.is_featured !== undefined) item.isFeatured = dto.is_featured;
    if (dto.status_text !== undefined) item.statusText = dto.status_text;
    if (dto.campus_text !== undefined) item.campusText = dto.campus_text;
    if (dto.budget_text !== undefined) item.budgetText = dto.budget_text;
    if (dto.completion_text !== undefined) item.completionText = dto.completion_text;
    // Empty string clears the bound (T-HOME-CMS-3, TH3-5).
    if (dto.scheduled_start !== undefined) {
      item.scheduledStart = dto.scheduled_start ? new Date(dto.scheduled_start) : undefined;
    }
    if (dto.scheduled_end !== undefined) {
      item.scheduledEnd = dto.scheduled_end ? new Date(dto.scheduled_end) : undefined;
    }
    item.updatedBy = userId;

    await this.em.flush();
    this.logger.log(`HOMEPAGE_ITEM_UPDATED: id=${id}, by=${userId}`);
    return item;
  }

  async reorderItems(
    dto: ReorderHomepageItemsDto,
    userId: string,
  ): Promise<{ updated: number }> {
    let updated = 0;
    for (const entry of dto.items) {
      const item = await this.itemsRepo.findOne({ id: entry.id });
      if (item) {
        item.itemOrder = entry.item_order;
        item.updatedBy = userId;
        updated++;
      }
    }
    await this.em.flush();
    this.logger.log(`HOMEPAGE_ITEMS_REORDERED: count=${updated}, by=${userId}`);
    return { updated };
  }

  async removeItem(id: string, userId: string): Promise<void> {
    const item = await this.findOneItem(id);
    item.deletedAt = new Date();
    item.deletedBy = userId;
    await this.em.flush();
    this.logger.log(`HOMEPAGE_ITEM_DELETED: id=${id}, by=${userId}`);
  }

  // ---- Public aggregate (anonymous homepage, single call — THC-4) ----

  async getPublicContent(pageKey = 'home'): Promise<{
    settings: Record<string, string>;
    items: Record<string, unknown[]>;
  }> {
    const now = new Date();
    const [settings, allItems] = await Promise.all([
      this.settingsRepo.findAll({ where: { pageKey } }),
      this.itemsRepo.find(
        { isPublished: true, pageKey },
        { orderBy: { isPinned: 'desc', itemOrder: 'asc', createdAt: 'asc' } },
      ),
    ]);

    // T-HOME-CMS-3 (TH3-5): schedule window — NULL bounds are open-ended.
    const items = allItems.filter((i) => {
      if (i.scheduledStart && i.scheduledStart > now) return false;
      if (i.scheduledEnd && i.scheduledEnd < now) return false;
      return true;
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.settingKey] = s.settingValue ?? '';
    }

    // Resolve item images to public /uploads paths + alt text (images only —
    // T2 hardening keeps non-image files behind the authenticated document API).
    const mediaIds = items.map((i) => i.mediaId).filter((v): v is string => !!v);
    const mediaPaths = new Map<string, string>();
    const mediaAlts = new Map<string, string>();
    if (mediaIds.length) {
      const mediaRows = await this.em.find(Media, { id: { $in: mediaIds } });
      for (const m of mediaRows) {
        mediaPaths.set(m.id, m.filePath);
        mediaAlts.set(m.id, m.altText ?? '');
      }
    }

    const grouped: Record<string, unknown[]> = {};
    for (const item of items) {
      const list = (grouped[item.sectionKey] ??= []);
      list.push({
        id: item.id,
        item_order: item.itemOrder,
        title: item.title ?? '',
        body: item.body ?? '',
        icon: item.icon ?? '',
        link_url: item.linkUrl ?? '',
        value_source: item.valueSource ?? '',
        manual_value: item.manualValue ?? '',
        image_url: item.mediaId ? (mediaPaths.get(item.mediaId) ?? '') : '',
        alt_text: item.mediaId ? (mediaAlts.get(item.mediaId) ?? '') : '',
        is_pinned: item.isPinned,
        color_token: item.colorToken ?? '',
        created_at: item.createdAt.toISOString(),
        // T-HOME-CMS-11 (TH11-2): Featured News fields — plain, standalone,
        // no COI resolution (RH11-3 supersedes T-HOME-CMS-8's linked_project).
        subtitle: item.subtitle ?? '',
        full_description: item.fullDescription ?? '',
        author: item.author ?? '',
        department: item.department ?? '',
        publish_date: item.publishDate ? item.publishDate.toISOString().slice(0, 10) : '',
        is_featured: item.isFeatured,
        status_text: item.statusText ?? '',
        campus_text: item.campusText ?? '',
        budget_text: item.budgetText ?? '',
        completion_text: item.completionText ?? '',
      });
    }

    return { settings: settingsMap, items: grouped };
  }
}

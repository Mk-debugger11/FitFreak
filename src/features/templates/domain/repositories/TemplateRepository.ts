import { Template } from '../entities/Template';

export interface TemplateRepository {
  getTemplates(): Promise<Template[]>;
  getTemplateById(id: string): Promise<Template | null>;
  createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
}

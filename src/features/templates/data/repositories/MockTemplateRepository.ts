import { TemplateRepository } from '../../domain/repositories/TemplateRepository';
import { Template } from '../../domain/entities/Template';

export class MockTemplateRepository implements TemplateRepository {
  private templates: Template[] = [
    // sample templates
  ];

  async getTemplates(): Promise<Template[]> {
    return Promise.resolve([...this.templates]);
  }

  async getTemplateById(id: string): Promise<Template | null> {
    const template = this.templates.find(t => t.id === id);
    return Promise.resolve(template || null);
  }

  async createTemplate(templateData: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const newTemplate: Template = {
      ...templateData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.templates.push(newTemplate);
    return Promise.resolve(newTemplate);
  }

  async deleteTemplate(id: string): Promise<void> {
    this.templates = this.templates.filter(t => t.id !== id);
    return Promise.resolve();
  }
}

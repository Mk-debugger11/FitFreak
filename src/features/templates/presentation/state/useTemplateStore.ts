import { create } from 'zustand';
import { Template } from '../../domain/entities/Template';
import { MockTemplateRepository } from '../../data/repositories/MockTemplateRepository';

interface TemplateState {
  templates: Template[];
  isLoading: boolean;
  error: string | null;
  fetchTemplates: () => Promise<void>;
  addTemplate: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const repository = new MockTemplateRepository();

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  isLoading: false,
  error: null,
  fetchTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await repository.getTemplates();
      set({ templates: data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch templates', isLoading: false });
    }
  },
  addTemplate: async (templateData) => {
    set({ isLoading: true, error: null });
    try {
      const newTemplate = await repository.createTemplate(templateData);
      set((state) => ({
        templates: [...state.templates, newTemplate],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to create template', isLoading: false });
    }
  },
}));


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { AudioSegment } from './audioMixer';
import { GenerateVideoParams } from '../types';

// --- Domain Entities ---

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectData extends ProjectMetadata {
  videoBlob: Blob;
  segments: AudioSegment[]; // Contains blobs which need handling during storage
  params: GenerateVideoParams | null;
  videoUrl?: string; // Transient: Generated on load, not stored persistently
}

// --- Repository Interface ---
// This interface allows us to swap the backend (IndexedDB, Firebase, S3, R2) easily.
export interface IProjectRepository {
  save(project: ProjectData): Promise<void>;
  get(id: string): Promise<ProjectData>;
  list(): Promise<ProjectMetadata[]>;
  delete(id: string): Promise<void>;
}

// --- Concrete Implementation: IndexedDB ---
// The current "Local-First" implementation.

const DB_NAME = 'VeoStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

class IndexedDBRepository implements IProjectRepository {
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (event) => reject('Database error: ' + (event.target as any).error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };
    });
  }

  async save(data: ProjectData): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Clean up data for storage (remove transient URLs)
      // IndexedDB can store Blobs directly, but ObjectURLs must be revoked/recreated
      const segmentsToStore = data.segments.map(seg => ({
        ...seg,
        url: null, // Don't store object URLs, they expire
        isGenerating: false
      }));

      const projectToStore = {
        ...data,
        segments: segmentsToStore,
        updatedAt: Date.now()
      };

      const request = store.put(projectToStore);
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Save failed');
    });
  }

  async list(): Promise<ProjectMetadata[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as ProjectData[];
        // Return only metadata to save memory
        const metadata = results.map(p => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        })).sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(metadata);
      };
      request.onerror = () => reject('List failed');
    });
  }

  async get(id: string): Promise<ProjectData> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const project = request.result as ProjectData;
        if (!project) {
          reject('Project not found');
          return;
        }

        // Rehydrate URLs
        // We do NOT rehydrate the main videoUrl here because that is typically 
        // managed by the UI state (App.tsx) using the blob.
        // However, we DO rehydrate audio segment URLs because they are internal to the timeline.
        
        const rehydratedSegments = project.segments.map(seg => ({
          ...seg,
          url: seg.blob ? URL.createObjectURL(seg.blob) : null
        }));

        resolve({
          ...project,
          segments: rehydratedSegments
        });
      };
      request.onerror = () => reject('Load failed');
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Delete failed');
    });
  }
}

// --- Service Layer ---
// The main entry point for the application.

export class ProjectService {
  constructor(private repo: IProjectRepository) {}

  async saveProject(data: ProjectData): Promise<void> {
    return this.repo.save(data);
  }

  async loadProject(id: string): Promise<ProjectData> {
    return this.repo.get(id);
  }

  async getAllProjects(): Promise<ProjectMetadata[]> {
    return this.repo.list();
  }

  async deleteProject(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}

// Export a singleton instance using the default implementation
export const projectService = new ProjectService(new IndexedDBRepository());

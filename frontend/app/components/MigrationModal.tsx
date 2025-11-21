import React, { useState } from 'react';
import { ProjectMigrationService } from '../services/projectMigrationService';
import { localStorageService } from '../utils/localStorageService';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrate: () => void;
  token: string;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  onMigrate,
  token
}) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationType, setMigrationType] = useState<'single' | 'all'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [error, setError] = useState('');

  const localProjects = localStorageService.getAllProjects();
  const hasMultipleProjects = localProjects.length > 1;

  const handleMigration = async () => {
    if (migrationType === 'single' && !selectedProject) {
      setError('Please select a project to migrate');
      return;
    }

    setIsMigrating(true);
    setError('');

    try {
      if (migrationType === 'single') {
        await ProjectMigrationService.migrateGuestProject(selectedProject, token);
      } else {
        await ProjectMigrationService.syncAllLocalProjects(token);
      }
      
      onMigrate();
      onClose();
    } catch (err) {
      setError('Migration failed. Please try again.');
      console.error('Migration error:', err);
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Migrate Local Projects</h2>
        
        <p className="text-gray-600 mb-4">
          You have {localProjects.length} local project(s) that can be saved to your account.
        </p>

        {hasMultipleProjects && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Migration Option:
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="migrationType"
                  value="all"
                  checked={migrationType === 'all'}
                  onChange={(e) => setMigrationType(e.target.value as 'all')}
                  className="mr-2"
                />
                Migrate all projects ({localProjects.length})
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="migrationType"
                  value="single"
                  checked={migrationType === 'single'}
                  onChange={(e) => setMigrationType(e.target.value as 'single')}
                  className="mr-2"
                />
                Migrate specific project
              </label>
            </div>
          </div>
        )}

        {migrationType === 'single' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Project:
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose a project...</option>
              {localProjects.map(project => (
                <option key={project.project_id} value={project.project_id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isMigrating}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMigration}
            disabled={isMigrating}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isMigrating ? 'Migrating...' : 'Migrate Projects'}
          </button>
        </div>
      </div>
    </div>
  );
};
import { Project } from '@/types/mixer';

interface ProjectTabsProps {
  projects: Project[];
  currentIndex: number;
  onSelectProject: (index: number) => void;
  onDeleteProject: (index: number) => void;
}

export function ProjectTabs({
  projects,
  currentIndex,
  onSelectProject,
  onDeleteProject,
}: ProjectTabsProps) {
  if (projects.length === 0) return null;

  return (
    <div className="mt-6 flex gap-2 flex-wrap justify-center items-center">
      <span className="text-sm font-semibold opacity-70 text-foreground">Proyectos:</span>
      {projects.map((project, index) => (
        <button
          key={index}
          className={`px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 ${
            index === currentIndex
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground border-2 border-primary'
          }`}
          onClick={() => onSelectProject(index)}
        >
          {project.name}
          <span
            className="ml-2 opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteProject(index);
            }}
          >
            ✕
          </span>
        </button>
      ))}
    </div>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import React, { useState } from 'react';
import { COURSES } from '@/lib/courseContent';
import { useProgress } from '@/lib/progress';

export const Route = createFileRoute('/courses')({
  head: () => ({
    meta: [
      { title: 'Courses — NetSem' },
      { name: 'description', content: 'Networking courses: fundamentals, routing, security, wireless, troubleshooting, and CCNA prep' },
    ],
  }),
  component: CoursesPage,
});

const difficultyColors: Record<string, string> = {
  beginner: 'text-terminal border-terminal/30 bg-terminal/10',
  intermediate: 'text-noc-yellow border-noc-yellow/30 bg-noc-yellow/10',
  advanced: 'text-noc-red border-noc-red/30 bg-noc-red/10',
};

function CoursesPage() {
  const [filter, setFilter] = useState<string>('all');
  const progress = useProgress();
  const filtered = filter === 'all' ? COURSES : COURSES.filter(c => c.difficulty === filter);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-display text-terminal text-glow tracking-wider mb-2">LEARNING PATHS</h1>
      <p className="text-sm text-muted-foreground mb-6">Master networking from fundamentals to advanced routing protocols</p>

      <div className="flex gap-2 mb-8">
        {['all', 'beginner', 'intermediate', 'advanced'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded border transition-all ${
              filter === f
                ? 'border-terminal text-terminal bg-terminal/10'
                : 'border-border text-muted-foreground hover:border-terminal/30'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(course => {
          const done = (progress.lessons[course.id] || []).length;
          const percent = course.lessons.length === 0 ? 0 : Math.round((done / course.lessons.length) * 100);
          return (
            <Link
              key={course.id}
              to="/courses/$courseId"
              params={{ courseId: course.id }}
              className="border border-border rounded-lg p-5 bg-card/50 hover:border-terminal/30 transition-all group block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{course.icon}</span>
                  <h3 className="text-sm font-display text-foreground tracking-wider group-hover:text-terminal transition-colors">{course.title}</h3>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded border ${difficultyColors[course.difficulty]}`}>
                  {course.difficulty.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{course.description}</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {course.topics.slice(0, 4).map(t => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{t}</span>
                ))}
                {course.topics.length > 4 && (
                  <span className="text-[9px] px-1.5 py-0.5 text-muted-foreground">+{course.topics.length - 4}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-terminal rounded-full transition-all" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground">{percent}%</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-2">{course.lessons.length} lessons · {course.quiz.length} quiz</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
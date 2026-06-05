import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import React, { useState, useMemo, useEffect } from 'react';
import { getCourse } from '@/lib/courseContent';
import { useCourseProgress, completeLesson, saveNote, saveQuizScore, trackEvent } from '@/lib/progress';

export const Route = createFileRoute('/courses/$courseId')({
  head: ({ params }) => ({
    meta: [
      { title: `${params.courseId} — NetSem Courses` },
      { name: 'description', content: 'Interactive networking course with lessons, notes and quizzes' },
    ],
  }),
  component: CourseReader,
});

function renderBody(md: string) {
  // Tiny markdown renderer: headings, bold, code blocks, lists.
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc list-inside space-y-1 my-3 text-sm text-foreground/90">
          {listBuf.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(li) }} />)}
        </ul>
      );
      listBuf = [];
    }
  };
  const inline = (s: string) =>
    s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-secondary text-terminal text-[11px]">$1</code>')
     .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground">$1</strong>');
  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (inCode) {
        out.push(<pre key={`code-${out.length}`} className="my-3 p-3 rounded bg-black/40 border border-border overflow-x-auto text-[11px] font-mono text-terminal">{codeBuf.join('\n')}</pre>);
        codeBuf = []; inCode = false;
      } else { flushList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    if (raw.startsWith('# ')) { flushList(); out.push(<h1 key={out.length} className="text-2xl font-display text-terminal mt-4 mb-3 tracking-wider">{raw.slice(2)}</h1>); continue; }
    if (raw.startsWith('## ')) { flushList(); out.push(<h2 key={out.length} className="text-lg font-display text-foreground mt-4 mb-2">{raw.slice(3)}</h2>); continue; }
    if (raw.startsWith('- ')) { listBuf.push(raw.slice(2)); continue; }
    if (raw.match(/^\d+\.\s/)) { listBuf.push(raw.replace(/^\d+\.\s/, '')); continue; }
    flushList();
    if (raw.trim() === '') { out.push(<div key={out.length} className="h-2" />); continue; }
    out.push(<p key={out.length} className="text-sm text-foreground/90 my-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: inline(raw) }} />);
  }
  flushList();
  return out;
}

function CourseReader() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const course = useMemo(() => getCourse(courseId), [courseId]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(course?.lessons[0]?.id || null);
  const [view, setView] = useState<'lessons' | 'notes' | 'quiz'>('lessons');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zoom, setZoom] = useState(100); // PDF-like zoom
  const cp = useCourseProgress(courseId, course?.lessons.length || 0);
  const [noteDraft, setNoteDraft] = useState(cp.note);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);

  // Keyboard navigation (PageUp / PageDown / Arrows)
  useEffect(() => {
    if (!course) return;
    const handler = (e: KeyboardEvent) => {
      if (view !== 'lessons') return;
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const i = course.lessons.findIndex(l => l.id === activeLessonId);
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (i < course.lessons.length - 1) setActiveLessonId(course.lessons[i + 1].id); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (i > 0) setActiveLessonId(course.lessons[i - 1].id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [course, activeLessonId, view]);

  if (!course) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Course not found.</p>
        <Link to="/courses" className="text-terminal text-sm">← Back to courses</Link>
      </div>
    );
  }

  const activeLesson = course.lessons.find(l => l.id === activeLessonId) || course.lessons[0];
  const lessonIdx = course.lessons.findIndex(l => l.id === activeLesson.id);

  const markComplete = () => {
    completeLesson(courseId, activeLesson.id);
    // Auto-advance
    const idx = course.lessons.findIndex(l => l.id === activeLesson.id);
    if (idx >= 0 && idx < course.lessons.length - 1) {
      setActiveLessonId(course.lessons[idx + 1].id);
    }
  };

  const submitQuiz = () => {
    let correct = 0;
    for (const q of course.quiz) {
      if (quizAnswers[q.id] === q.answer) correct++;
    }
    const score = Math.round((correct / course.quiz.length) * 100);
    const passed = score >= 70;
    saveQuizScore(courseId, 'final', score, passed);
    setQuizResult({ score, passed });
    if (passed && cp.completed === course.lessons.length) {
      trackEvent('course_complete', { courseId });
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-72 border-r border-border bg-card/60 backdrop-blur-md overflow-y-auto flex-shrink-0`}>
        <div className="p-4 border-b border-border sticky top-0 bg-card/80 backdrop-blur-md z-10">
          <Link to="/courses" className="text-[10px] text-muted-foreground hover:text-terminal inline-flex items-center gap-1">← All courses</Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl">{course.icon}</span>
            <h2 className="text-sm font-display text-terminal tracking-wider leading-tight">{course.title}</h2>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-terminal to-noc-cyan transition-all" style={{ width: `${cp.percent}%` }} />
            </div>
            <span className="text-[10px] font-mono text-terminal">{cp.percent}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{cp.completed}/{cp.total} chapters complete</p>
        </div>
        <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Chapters</div>
        <nav className="p-2 space-y-1">
          {course.lessons.map((l, i) => {
            const done = cp.isDone(l.id);
            const active = l.id === activeLesson.id && view === 'lessons';
            return (
              <button
                key={l.id}
                onClick={() => { setActiveLessonId(l.id); setView('lessons'); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-3 transition-all ${
                  active
                    ? 'bg-terminal/15 text-terminal border border-terminal/40 shadow-[0_0_12px_-4px_hsl(var(--terminal)/0.5)]'
                    : 'text-foreground/80 hover:bg-accent hover:translate-x-0.5 border border-transparent'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-[10px] font-mono flex items-center justify-center border flex-shrink-0 ${done ? 'bg-terminal text-background border-terminal' : 'border-border'}`}>{done ? '✓' : i + 1}</span>
                <span className="truncate flex-1">{l.title}</span>
                {l.readMinutes && <span className="text-[9px] text-muted-foreground">{l.readMinutes}m</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-border space-y-1 sticky bottom-0 bg-card/80 backdrop-blur-md">
          <button onClick={() => { setView('notes'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-md text-xs ${view === 'notes' ? 'bg-terminal/15 text-terminal border border-terminal/40' : 'text-foreground/80 hover:bg-accent border border-transparent'}`}>📝 My Notes</button>
          <button onClick={() => { setView('quiz'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-md text-xs ${view === 'quiz' ? 'bg-terminal/15 text-terminal border border-terminal/40' : 'text-foreground/80 hover:bg-accent border border-transparent'}`}>🎯 Final Quiz</button>
          {cp.percent === 100 && (
            <div className="mt-2 px-3 py-2 rounded-md border border-terminal/40 bg-gradient-to-r from-terminal/10 to-noc-cyan/10 text-[10px] text-terminal text-center font-display tracking-wider">
              🏆 CERTIFIED
            </div>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* PDF-style toolbar */}
        <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-2 border-b border-border bg-card/70 backdrop-blur-md">
          <button onClick={() => setSidebarOpen(o => !o)} className="md:hidden text-xs px-2 py-1 border border-border rounded">☰</button>
          {view === 'lessons' && (
            <>
              <span className="text-[10px] font-mono text-muted-foreground">
                Page <span className="text-terminal">{lessonIdx + 1}</span> / {course.lessons.length}
              </span>
              <div className="hidden sm:flex items-center gap-1 ml-2">
                <button onClick={() => lessonIdx > 0 && setActiveLessonId(course.lessons[lessonIdx - 1].id)} disabled={lessonIdx === 0} className="px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-30">◀</button>
                <button onClick={() => lessonIdx < course.lessons.length - 1 && setActiveLessonId(course.lessons[lessonIdx + 1].id)} disabled={lessonIdx === course.lessons.length - 1} className="px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-30">▶</button>
              </div>
              <div className="flex-1" />
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
                <button onClick={() => setZoom(z => Math.max(80, z - 10))} className="px-2 py-0.5 rounded hover:bg-accent">−</button>
                <span className="font-mono w-10 text-center">{zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(140, z + 10))} className="px-2 py-0.5 rounded hover:bg-accent">+</button>
              </div>
              {activeLesson.readMinutes && <span className="hidden sm:inline text-[10px] text-muted-foreground ml-3">⏱ {activeLesson.readMinutes} min read</span>}
            </>
          )}
          {view !== 'lessons' && <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{view}</span>}
        </div>

        {/* Page area */}
        <div className="px-4 md:px-10 py-8 flex justify-center">
          <div
            className={view === 'lessons' ? 'w-full max-w-3xl bg-card/70 backdrop-blur-sm border border-border rounded-xl shadow-2xl shadow-black/40 p-8 md:p-12 relative' : 'w-full max-w-3xl'}
            style={view === 'lessons' ? { fontSize: `${zoom}%` } : undefined}
          >
          {view === 'lessons' && (
            <>
              {/* Page header */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b border-border/60">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">{course.title} · Chapter {lessonIdx + 1}</div>
                  <h1 className="text-2xl md:text-3xl font-display text-terminal tracking-wide">{activeLesson.title}</h1>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">#{String(lessonIdx + 1).padStart(2, '0')}</span>
              </div>

              {/* Concept Architecture diagram */}
              {activeLesson.diagram && (
                <figure className="my-6 rounded-lg border border-terminal/20 bg-gradient-to-br from-secondary/30 to-secondary/10 p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-3 text-[9px] uppercase tracking-wider text-terminal/70 font-mono">CONCEPT ARCHITECTURE</div>
                  <div dangerouslySetInnerHTML={{ __html: activeLesson.diagram }} />
                  <figcaption className="text-[10px] text-muted-foreground italic text-center mt-2">Fig. {lessonIdx + 1} — {activeLesson.title}</figcaption>
                </figure>
              )}

              <article className="prose-invert">{renderBody(activeLesson.body)}</article>

              <div className="mt-10 flex justify-between items-center border-t border-border pt-6">
                <button
                  disabled={lessonIdx === 0}
                  onClick={() => lessonIdx > 0 && setActiveLessonId(course.lessons[lessonIdx - 1].id)}
                  className="text-xs px-4 py-2 rounded-md border border-border text-muted-foreground hover:border-terminal/40 hover:text-foreground disabled:opacity-30 transition-all"
                >← Previous</button>
                {cp.isDone(activeLesson.id) ? (
                  <span className="text-xs text-terminal flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-terminal animate-pulse" /> Completed</span>
                ) : (
                  <button onClick={markComplete} className="text-xs px-5 py-2 rounded-md bg-gradient-to-r from-primary to-terminal text-primary-foreground font-display tracking-wider shadow-lg shadow-terminal/20 hover:shadow-terminal/40 transition-all">
                    MARK COMPLETE & NEXT
                  </button>
                )}
                <button
                  disabled={lessonIdx === course.lessons.length - 1}
                  onClick={() => lessonIdx < course.lessons.length - 1 && setActiveLessonId(course.lessons[lessonIdx + 1].id)}
                  className="text-xs px-4 py-2 rounded-md border border-border text-muted-foreground hover:border-terminal/40 hover:text-foreground disabled:opacity-30 transition-all"
                >Next →</button>
              </div>
            </>
          )}
          {view === 'notes' && (
            <>
              <h1 className="text-2xl font-display text-terminal mb-4 tracking-wider">MY NOTES</h1>
              <p className="text-xs text-muted-foreground mb-3">Your private notes for this course (saved locally).</p>
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                onBlur={() => saveNote(courseId, noteDraft)}
                placeholder="Write your notes here..."
                className="w-full h-96 p-4 bg-secondary/40 border border-border rounded text-sm font-mono text-foreground outline-none focus:border-terminal/50 resize-none"
              />
              <button onClick={() => saveNote(courseId, noteDraft)} className="mt-3 px-4 py-2 rounded bg-primary text-primary-foreground text-xs">Save Notes</button>
            </>
          )}
          {view === 'quiz' && (
            <>
              <h1 className="text-2xl font-display text-terminal mb-4 tracking-wider">FINAL QUIZ</h1>
              <p className="text-xs text-muted-foreground mb-6">Score 70% or higher to pass.</p>
              <div className="space-y-6">
                {course.quiz.map((q, i) => (
                  <div key={q.id} className="border border-border rounded-lg p-4 bg-card/40">
                    <p className="text-sm font-semibold text-foreground mb-3">{i + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const isChosen = quizAnswers[q.id] === oi;
                        const isCorrect = quizResult && oi === q.answer;
                        const isWrong = quizResult && isChosen && oi !== q.answer;
                        return (
                          <label key={oi} className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${
                            isCorrect ? 'border-terminal bg-terminal/10' :
                            isWrong ? 'border-noc-red bg-noc-red/10' :
                            isChosen ? 'border-terminal/50 bg-terminal/5' : 'border-border hover:border-terminal/30'
                          }`}>
                            <input
                              type="radio" name={q.id} checked={isChosen}
                              onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: oi })}
                              disabled={!!quizResult}
                              className="accent-terminal"
                            />
                            <span className="text-sm text-foreground">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {!quizResult ? (
                <button onClick={submitQuiz} className="mt-6 px-6 py-3 rounded bg-primary text-primary-foreground text-sm font-display tracking-wider">SUBMIT QUIZ</button>
              ) : (
                <div className={`mt-6 p-4 rounded border ${quizResult.passed ? 'border-terminal bg-terminal/10' : 'border-noc-red bg-noc-red/10'}`}>
                  <p className={`text-lg font-display ${quizResult.passed ? 'text-terminal' : 'text-noc-red'}`}>
                    {quizResult.passed ? '🎓 PASSED' : '✗ TRY AGAIN'} — {quizResult.score}%
                  </p>
                  <button onClick={() => { setQuizResult(null); setQuizAnswers({}); }} className="mt-3 text-xs underline text-muted-foreground">Retake quiz</button>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
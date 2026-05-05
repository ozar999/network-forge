import { createFileRoute } from '@tanstack/react-router';
import React, { useState } from 'react';

export const Route = createFileRoute('/courses')({
  head: () => ({
    meta: [
      { title: 'Courses — NetSim' },
      { name: 'description', content: 'Networking courses covering OSI Model, TCP/IP, Subnetting, VLANs, OSPF, BGP and more' },
    ],
  }),
  component: CoursesPage,
});

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topics: string[];
  progress: number;
  lessons: number;
}

const COURSES: Course[] = [
  { id: 'osi', title: 'OSI Model', description: 'Understand the 7 layers of networking', difficulty: 'beginner', topics: ['Physical', 'Data Link', 'Network', 'Transport', 'Session', 'Presentation', 'Application'], progress: 0, lessons: 7 },
  { id: 'tcpip', title: 'TCP/IP Stack', description: 'Deep dive into TCP/IP protocol suite', difficulty: 'beginner', topics: ['TCP', 'UDP', 'IP', 'ARP', 'ICMP'], progress: 0, lessons: 12 },
  { id: 'subnetting', title: 'Subnetting Mastery', description: 'CIDR, VLSM, and subnet calculations', difficulty: 'intermediate', topics: ['CIDR', 'VLSM', 'Supernetting', 'IPv6'], progress: 0, lessons: 10 },
  { id: 'vlans', title: 'VLANs & Trunking', description: 'Virtual LANs, 802.1Q, and inter-VLAN routing', difficulty: 'intermediate', topics: ['Access Ports', 'Trunk Ports', '802.1Q', 'VTP', 'Inter-VLAN'], progress: 0, lessons: 8 },
  { id: 'ospf', title: 'OSPF Routing', description: 'Open Shortest Path First protocol', difficulty: 'advanced', topics: ['Areas', 'LSAs', 'DR/BDR', 'Cost', 'Authentication'], progress: 0, lessons: 15 },
  { id: 'bgp', title: 'BGP Fundamentals', description: 'Border Gateway Protocol for ISP routing', difficulty: 'advanced', topics: ['eBGP', 'iBGP', 'Path Selection', 'Communities', 'Route Filtering'], progress: 0, lessons: 18 },
  { id: 'nat', title: 'NAT & PAT', description: 'Network Address Translation techniques', difficulty: 'intermediate', topics: ['Static NAT', 'Dynamic NAT', 'PAT', 'NAT64'], progress: 0, lessons: 6 },
  { id: 'acls', title: 'Access Control Lists', description: 'Standard and extended ACL configuration', difficulty: 'intermediate', topics: ['Standard ACLs', 'Extended ACLs', 'Named ACLs', 'Reflexive'], progress: 0, lessons: 8 },
];

const difficultyColors: Record<string, string> = {
  beginner: 'text-terminal border-terminal/30 bg-terminal/10',
  intermediate: 'text-noc-yellow border-noc-yellow/30 bg-noc-yellow/10',
  advanced: 'text-noc-red border-noc-red/30 bg-noc-red/10',
};

function CoursesPage() {
  const [filter, setFilter] = useState<string>('all');

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
        {filtered.map(course => (
          <div key={course.id} className="border border-border rounded-lg p-5 bg-card/50 hover:border-terminal/30 transition-all group">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-display text-foreground tracking-wider group-hover:text-terminal transition-colors">{course.title}</h3>
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
                <div className="h-full bg-terminal rounded-full transition-all" style={{ width: `${course.progress}%` }} />
              </div>
              <span className="text-[9px] text-muted-foreground">{course.progress}%</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">{course.lessons} lessons</div>
          </div>
        ))}
      </div>
    </div>
  );
}
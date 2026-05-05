import { createFileRoute } from '@tanstack/react-router';
import { LabSimulator } from '../components/lab/LabSimulator';

export const Route = createFileRoute('/lab')({
  head: () => ({
    meta: [
      { title: 'Lab Simulator — NetSim' },
      { name: 'description', content: 'Interactive network lab simulator with drag-and-drop topology builder and CLI terminal' },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  return <LabSimulator />;
}
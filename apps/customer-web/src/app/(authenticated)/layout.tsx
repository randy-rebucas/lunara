import { AuthenticatedGate } from '../../components/authenticated-gate';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedGate>{children}</AuthenticatedGate>;
}

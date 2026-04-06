export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen bg-background animate-in fade-in duration-300">
      {children}
    </div>
  );
}

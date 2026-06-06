import Link from "next/link";

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8">
        <Link
          href="/"
          className="font-heading text-2xl font-bold tracking-tight text-foreground"
        >
          Aloalo
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

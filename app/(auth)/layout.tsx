import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link
            href="/"
            className="font-heading text-2xl font-bold tracking-tight text-foreground"
          >
            Aloalo
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

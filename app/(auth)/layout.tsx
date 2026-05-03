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
            className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent"
          >
            Aloalo
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

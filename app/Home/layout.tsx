import Navbar from "../components/Navbar";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="p-6">
        {children}
      </main>
    </>
  );
}

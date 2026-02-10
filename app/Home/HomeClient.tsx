import dynamic from "next/dynamic";

// Load HomeClient WITHOUT server-side rendering
const HomeClient = dynamic(() => import("./HomeClient"), {
  ssr: false,
});

export default function HomePage() {
  return <HomeClient />;
}

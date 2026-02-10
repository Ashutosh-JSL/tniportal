"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomeClient() {
  const [data, setData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/Home")
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
     

      <main className="p-6">
        <h2 className="text-2xl font-bold mb-4">
          Welcome, {data.user.name} 👋
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {data.stats.map((item: any, i: number) => (
            <div
              key={i}
              className="bg-white p-5 rounded-xl shadow hover:shadow-xl transition"
            >
              <h3 className="text-gray-500 text-sm">{item.title}</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import "./globals.css";
import Image from "next/image";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Krishna University - College of Engineering and Technology",
  description: "Academic Portal for Results, CGPA Management & Department Information",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased bg-slate-50 text-slate-900 flex flex-col min-h-screen`}>
        <div className="flex-grow flex flex-col w-full relative">
          {/* subtle animated background element behind everything */}
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none -z-10" />

          <Navbar />

          {/* Main Content */}
          <main className="page-container animate-fade-in flex-grow tracking-normal relative">
            {children}
          </main>


          {/* Footer */}
          <footer className="bg-gray-900 text-white p-6 mt-10">
            <div className="max-w-6xl mx-auto text-center">
              <h2 className="font-bold text-lg">
                Krishna University
              </h2>
              <p>Machilipatnam, Andhra Pradesh, India - 521004</p>

              <div className="mt-4">
                <Link href="/admin-login" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Admin Login
                </Link>
              </div>

              <p className="text-sm mt-4 text-gray-400">
                © {new Date().getFullYear()} Krishna University
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}


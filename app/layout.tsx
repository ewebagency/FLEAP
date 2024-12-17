"use client"
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SideBar from "./component/SideBar";
import { SessionProvider } from "./component/SessionProvider";
import { FilterProvider } from "./FilterContext";
import { AccessOtherAccountProvider } from "./interface_admin_2/AccessOtherAccounts/AccessOtherAccountContext";
import { usePathname } from 'next/navigation';
import { ModalProviderNew } from "./register/RegisterComponents/Modal/ContextModal";
import { MailProvider } from "./register/MailComponents/MailContext";
import { SSEHandler } from './component/SSEHandler';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const noSidebarRoutes = ['/', '/auth/signin', '/auth/signup', '/auth/merci'];
  const showSidebar = !noSidebarRoutes.includes(pathname);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <FilterProvider>
            <AccessOtherAccountProvider>
              <ModalProviderNew>
                <MailProvider>
                  <SSEHandler />
                  <div className="flex h-screen">
                    {showSidebar && <SideBar className_props="min-h-full" />}
                    <main className={`flex-1 overflow-y-auto ${!showSidebar ? 'w-full' : ''}`}>
                      {children}
                    </main>
                  </div>
                </MailProvider>
              </ModalProviderNew>
            </AccessOtherAccountProvider>
          </FilterProvider>
        </SessionProvider>  
      </body>
    </html>
  );
}
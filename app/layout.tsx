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
import NotificationPoller from "./component/NotificationPoller";
import { RecurrenceInitializer } from './register/RegisterComponents/Modal/Recurrence/RecurrenceInitializer';
//import { SSEHandler } from './component/SSEHandler';

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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <style>
          {`
            :root {
              /* Tailles de police */
              --text-sm: 0.75rem;    /* 12px */
              --text-base: 0.875rem; /* 14px */
              --text-lg: 1rem;       /* 16px */

              /* Verts */
              --green-light: #53ae72;
              --green-medium: #157235;
              --green-dark: #006121;

              /* Bleus */
              --blue-light: #60a5fa;
              --blue-medium: #3b82f6;
              --blue-dark: #2563eb;

              /* Orange */
              --orange-light: #fb923c;
              --orange-medium: #f97316;
              --orange-dark: #ea580c;

              /* Rouge */
              --red-light: #f87171;
              --red-medium: #ef4444;
              --red-dark: #dc2626;

              /* Gris */
              --gray-light: #f3f4f6;
              --gray-medium: #9ca3af;
              --gray-dark: #4b5563;
            }

            body {
              font-family: sans-serif;
              font-weight: 400;
            }

            /* Définir le poids de police par défaut pour tous les éléments */
            * {
              font-weight: 300;
            }

            /* Réserver le bold pour des cas spécifiques */
            .font-bold {
              font-weight: 600;
            }
            .font-semibold {
              font-weight: 500;
            }
          `}
        </style>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black`}>
        <SessionProvider>
          <FilterProvider>
            <AccessOtherAccountProvider>
              <ModalProviderNew>
              <MailProvider>
                <NotificationPoller />
                <RecurrenceInitializer />
                {/*<SSEHandler />*/}
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
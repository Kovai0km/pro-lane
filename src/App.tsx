import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { 
  PageSkeleton, 
  DashboardSkeleton, 
  ProjectSkeleton, 
  ChatSkeleton,
  ProfileSkeleton 
} from "@/components/ui/page-skeleton";

// Lazy load all pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Organization = lazy(() => import("./pages/Organization"));
const Project = lazy(() => import("./pages/Project"));
const Team = lazy(() => import("./pages/Team"));
const ProjectHub = lazy(() => import("./pages/ProjectHub"));
const Profile = lazy(() => import("./pages/Profile"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Settings = lazy(() => import("./pages/Settings"));
const Billing = lazy(() => import("./pages/Billing"));
const Features = lazy(() => import("./pages/Features"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Integrations = lazy(() => import("./pages/Integrations"));
const About = lazy(() => import("./pages/About"));
const Careers = lazy(() => import("./pages/Careers"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Chat = lazy(() => import("./pages/Chat"));
const ChannelList = lazy(() => import("./pages/ChannelList"));
const DirectMessageList = lazy(() => import("./pages/DirectMessageList"));
const Members = lazy(() => import("./pages/Members"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingFallback({ type = 'page' }: { type?: 'page' | 'dashboard' | 'project' | 'chat' | 'profile' }) {
  switch (type) {
    case 'dashboard': return <DashboardSkeleton />;
    case 'project': return <ProjectSkeleton />;
    case 'chat': return <ChatSkeleton />;
    case 'profile': return <ProfileSkeleton />;
    default: return <PageSkeleton />;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Suspense fallback={<LoadingFallback />}><Landing /></Suspense>} />
                <Route path="/auth" element={<Suspense fallback={<LoadingFallback />}><Auth /></Suspense>} />
                <Route path="/features" element={<Suspense fallback={<LoadingFallback />}><Features /></Suspense>} />
                <Route path="/pricing" element={<Suspense fallback={<LoadingFallback />}><Pricing /></Suspense>} />
                <Route path="/integrations" element={<Suspense fallback={<LoadingFallback />}><Integrations /></Suspense>} />
                <Route path="/about" element={<Suspense fallback={<LoadingFallback />}><About /></Suspense>} />
                <Route path="/careers" element={<Suspense fallback={<LoadingFallback />}><Careers /></Suspense>} />
                <Route path="/privacy" element={<Suspense fallback={<LoadingFallback />}><Privacy /></Suspense>} />
                <Route path="/terms" element={<Suspense fallback={<LoadingFallback />}><Terms /></Suspense>} />
                <Route path="/u/:username" element={<Suspense fallback={<LoadingFallback type="profile" />}><UserProfile /></Suspense>} />

                {/* Protected routes */}
                <Route path="/dashboard" element={<Suspense fallback={<LoadingFallback type="dashboard" />}><ProtectedRoute><Dashboard /></ProtectedRoute></Suspense>} />
                <Route path="/org/:orgId" element={<Suspense fallback={<LoadingFallback type="dashboard" />}><ProtectedRoute><Organization /></ProtectedRoute></Suspense>} />
                <Route path="/org/:orgId/projects" element={<Suspense fallback={<LoadingFallback />}><ProtectedRoute><ProjectHub /></ProtectedRoute></Suspense>} />
                <Route path="/org/:orgId/members" element={<Suspense fallback={<LoadingFallback />}><ProtectedRoute><Members /></ProtectedRoute></Suspense>} />
                <Route path="/org/:orgId/chat" element={<Suspense fallback={<LoadingFallback type="chat" />}><ProtectedRoute><Chat /></ProtectedRoute></Suspense>} />
                <Route path="/org/:orgId/chat/channels" element={<Suspense fallback={<LoadingFallback type="chat" />}><ProtectedRoute><ChannelList /></ProtectedRoute></Suspense>} />
                <Route path="/org/:orgId/chat/dms" element={<Suspense fallback={<LoadingFallback type="chat" />}><ProtectedRoute><DirectMessageList /></ProtectedRoute></Suspense>} />
                <Route path="/project/:projectId" element={<Suspense fallback={<LoadingFallback type="project" />}><ProtectedRoute><Project /></ProtectedRoute></Suspense>} />
                <Route path="/team/:teamId" element={<Suspense fallback={<LoadingFallback />}><ProtectedRoute><Team /></ProtectedRoute></Suspense>} />
                <Route path="/projects" element={<Suspense fallback={<LoadingFallback />}><ProtectedRoute><ProjectHub /></ProtectedRoute></Suspense>} />
                <Route path="/profile" element={<Suspense fallback={<LoadingFallback type="profile" />}><ProtectedRoute><Profile /></ProtectedRoute></Suspense>} />
                <Route path="/billing" element={<Suspense fallback={<LoadingFallback />}><ProtectedRoute><Billing /></ProtectedRoute></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={<LoadingFallback />}><ProtectedRoute><Settings /></ProtectedRoute></Suspense>} />

                <Route path="*" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

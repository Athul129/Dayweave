import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthScreen from "@/components/AuthScreen";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function AuthGate() {
  const { configured, loading, user } = useAuth();
  if (!configured) return <Router />;
  if (loading) return <main className="auth-loading" aria-live="polite"><div className="auth-brand"><div className="auth-brand-mark"><img src="/images/dayweave-mark.webp" alt="" /></div><strong>dayweave</strong></div><p>Finding your way back...</p></main>;
  if (!user) return <AuthScreen />;
  return <Router />;
}

function App() {
  return <ErrorBoundary>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Toaster />
        <AuthProvider><AuthGate /></AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>;
}

export default App;

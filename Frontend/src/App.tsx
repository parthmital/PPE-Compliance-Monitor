import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PPEProvider, usePPE } from "@/contexts/PPEContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import DetectionPage from "@/pages/DetectionPage";
import IncidentLogs from "@/pages/IncidentLogs";
import NotFound from "@/pages/NotFound";

function ThemedToaster() {
	const { isDarkMode } = usePPE();
	return <Toaster theme={isDarkMode ? "dark" : "light"} />;
}

const App = () => (
	<TooltipProvider delayDuration={300}>
		<PPEProvider>
			<ThemedToaster />
			<BrowserRouter
				future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
			>
				<AppLayout>
					<Routes>
						<Route path="/" element={<Dashboard />} />
						<Route path="/detection" element={<DetectionPage />} />
						<Route path="/incidents" element={<IncidentLogs />} />
						<Route path="*" element={<NotFound />} />
					</Routes>
				</AppLayout>
			</BrowserRouter>
		</PPEProvider>
	</TooltipProvider>
);

export default App;

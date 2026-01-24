import { RouterProvider } from "react-router";
import { router } from "./components/router/router";

export function App() {
  return <RouterProvider router={router} />;
}

export default App;

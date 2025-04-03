import { WalletConnection } from "./components/WalletConnection";
import { Form } from "./components/Form";
import { WalletProvider } from "./components/WalletProvider";

export default function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen p-4 sm:p-8 md:p-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-10 px-4">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Liquidium Recovery Tool
          </h1>
          <WalletConnection /> 
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto">
	        <Form />
        </main>
      </div>
    </WalletProvider>
  );
}

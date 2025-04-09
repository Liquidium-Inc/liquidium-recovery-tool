import { WalletConnection } from "./components/WalletConnection";
import { Form } from "./components/Form";
import { WalletProvider } from "./components/WalletProvider";

export default function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen flex flex-col p-4 sm:p-8 md:p-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-10 px-4">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Liquidium Recovery Tool
          </h1>
          <WalletConnection /> 
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto flex-grow">
	        <Form />
        </main>

        {/* Footer */}
        <footer className="mt-auto pt-8 pb-4 text-sm text-gray-600 max-w-4xl mx-auto">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold text-gray-700 mb-2">Legal Notice</p>
            <p>The Liquidium Vault Recovery Tool is provided as a free and open-source utility for community use. It is offered as-is, without any warranty—express or implied—including but not limited to warranties of merchantability or fitness for a particular purpose. Use at your own risk. The Liquidium team assumes no liability for loss, damage, or other issues arising from the use of this tool.</p>
          </div>
        </footer>
      </div>
    </WalletProvider>
  );
}

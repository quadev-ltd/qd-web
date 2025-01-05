import './App.css';
import Footer from './Footer';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={require('./assets/images/QuaDevIconAlpha.png')} className="App-logo" alt="logo" />
        <h2 className="App-tagline">Building Robust Software Solutions</h2>
      </header>
      <Footer />
    </div>
  );
}

export default App;

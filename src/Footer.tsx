import './Footer.css';

const Footer = () => {
  return (
    <footer className="App-footer">
      <p>© {new Date().getFullYear()} QuaDev. All rights reserved.</p>
      <div className="Footer-contact">
        <p>
          <strong>Address:</strong> Apartment 405, 1 Camberwell Passage, SE5 0AU, London, UK
        </p>
        <p>
          <strong>Email:</strong> <a href="mailto:gmfranco@live.com.ar">gmfranco@live.com.ar</a>
        </p>
        <p>
          <strong>Phone:</strong> <a href="tel:+447597300268">+44 7597 300 268</a>
        </p>
      </div>
    </footer>
  );
}
export default Footer;

import Home from './pages/Home';
import { Routes, Route } from 'react-router-dom';
import TodayInvoices from './pages/TodayInvoices';
import Products from './pages/Products';
import Customers from './pages/Customers';
import RoutePlanning from './pages/RoutePlanning';
import Trips from './pages/Trips';
import Invoices from './pages/Invoices';
import FileUploadPage from './pages/FileUploadPage';



function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={ <Home/> }/>
        <Route path="/todayInvoices" element={ <TodayInvoices/> }/>
        <Route path="/invoices" element={ <Invoices/> }/>
        <Route path="/products" element={ <Products/> }/>
        <Route path="/routePlanning" element={ <RoutePlanning/> }/>
        <Route path="/customers" element={ <Customers/> }/>
        <Route path="/trips" element={ <Trips/> }/>
        <Route path="/uploadFiles" element={ <FileUploadPage/> }/>
      </Routes>
    </div>
  );
}

export default App;

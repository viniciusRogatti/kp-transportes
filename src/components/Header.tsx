import { ContainerCards, HeaderStyle, MobileMenuButton, MobileMenuOverlay, MobileMenuPanel } from "../style/Header";
import CardsPages from "../components/CardsPages";
import { Link } from 'react-router-dom';
import { ImCalendar } from "react-icons/im";
import { ImAddressBook } from "react-icons/im";
import { ImTruck } from "react-icons/im";
import { ImUpload2 } from "react-icons/im";
import { ImBooks } from "react-icons/im";
import { ImDisplay } from "react-icons/im";
import { AiOutlineFileSearch } from "react-icons/ai";
import { MdOutlineReportProblem } from "react-icons/md";
import { useState } from "react";
import { HiMenu } from "react-icons/hi";
import { ImHome } from "react-icons/im";


function Header() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <HeaderStyle>
      <h1>KP TRANSPORTES</h1>
      <MobileMenuButton onClick={() => setIsOpen(true)} aria-label="Abrir menu">
        <HiMenu />
      </MobileMenuButton>
      <ContainerCards >
        <Link to='/home' title="Home" >
          <CardsPages pageNames="Home">
            <ImHome />
          </CardsPages>
        </Link>
        <Link to='/todayInvoices' title="Notas do dia" >

          <CardsPages pageNames="Notas do dia">
            <ImCalendar />
          </CardsPages>
        </Link>
        <Link to='/invoices'>
          <CardsPages pageNames="Pesquisar Notas">
            <AiOutlineFileSearch />
          </CardsPages>
        </Link>
        <Link to='/products'>
          <CardsPages pageNames="Itens Cadastrados">
            <ImBooks />
          </CardsPages>
        </Link>
        <Link to='/routePlanning'>
          <CardsPages pageNames="Roteirização">
            <ImDisplay />
          </CardsPages>
        </Link>
        <Link to='/customers'>
          <CardsPages pageNames="Clientes">
            <ImAddressBook />
          </CardsPages>
        </Link>
        <Link to='/trips'>
          <CardsPages pageNames="Trips">
            <ImTruck />
          </CardsPages>
        </Link>
        <Link to='/returns-occurrences'>
          <CardsPages pageNames="Devolucoes/Ocorrencias">
            <MdOutlineReportProblem />
          </CardsPages>
        </Link>
        <Link to='/uploadFiles'>
          <CardsPages pageNames="UploadFiles">
            <ImUpload2 />
          </CardsPages>
        </Link>
        {/* <Link to='/map'>
          <CardsPages pageNames="Map">
            <ImUpload2 />
          </CardsPages>
        </Link> */}
        {/* <Link to='/freightCalculate'>
          <CardsPages pageNames="FreightCalculate">
            <ImUpload2 />
          </CardsPages>
        </Link> */}
      </ContainerCards>
      <MobileMenuOverlay $open={isOpen} onClick={closeMenu} />
      <MobileMenuPanel $open={isOpen} aria-hidden={!isOpen}>
        <h2>Menu</h2>
        <nav>
          <Link to='/home' onClick={closeMenu}>
            <CardsPages pageNames="Home">
              <ImHome />
            </CardsPages>
          </Link>
          <Link to='/todayInvoices' onClick={closeMenu}>
            <CardsPages pageNames="Notas do dia">
              <ImCalendar />
            </CardsPages>
          </Link>
          <Link to='/invoices' onClick={closeMenu}>
            <CardsPages pageNames="Pesquisar Notas">
              <AiOutlineFileSearch />
            </CardsPages>
          </Link>
          <Link to='/products' onClick={closeMenu}>
            <CardsPages pageNames="Itens Cadastrados">
              <ImBooks />
            </CardsPages>
          </Link>
          <Link to='/routePlanning' onClick={closeMenu}>
            <CardsPages pageNames="Roteirização">
              <ImDisplay />
            </CardsPages>
          </Link>
          <Link to='/customers' onClick={closeMenu}>
            <CardsPages pageNames="Clientes">
              <ImAddressBook />
            </CardsPages>
          </Link>
          <Link to='/trips' onClick={closeMenu}>
            <CardsPages pageNames="Trips">
              <ImTruck />
            </CardsPages>
          </Link>
          <Link to='/returns-occurrences' onClick={closeMenu}>
            <CardsPages pageNames="Devolucoes/Ocorrencias">
              <MdOutlineReportProblem />
            </CardsPages>
          </Link>
          <Link to='/uploadFiles' onClick={closeMenu}>
            <CardsPages pageNames="UploadFiles">
              <ImUpload2 />
            </CardsPages>
          </Link>
        </nav>
      </MobileMenuPanel>
    </HeaderStyle>
  )
}

export default Header;

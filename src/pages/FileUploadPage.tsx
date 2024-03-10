import React, { useState } from 'react';
import axios from 'axios';
import { URL } from '../data';
import Header from '../components/Header';
import { Container } from '../style/incoives';

const FileUploadPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = event.target.files;
      const xmlFiles = Array.from(files).filter(file => file.name.endsWith('.xml'));
      setSelectedFiles(xmlFiles);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length > 0) {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        console.log(file);
        
        formData.append('files', file);
      });

      try {
        await axios.post(`${URL}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        console.log('Arquivos enviados com sucesso!');
      } catch (error) {
        console.error('Erro ao enviar arquivos:', error);
      }
    } else {
      console.error('Nenhum arquivo .xml selecionado.');
    }
  };

  return (
    <div>
      <Header />
      <Container>
        <input type="file" onChange={handleFileChange} multiple accept=".xml" />
        <button onClick={handleUpload}>Enviar Arquivos .xml</button>
      </Container>
    </div>
  );
};

export default FileUploadPage;

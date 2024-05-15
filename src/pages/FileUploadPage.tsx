import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../data';
import Header from '../components/Header';
import { Container } from '../style/incoives';
import verifyToken from '../utils/verifyToken';
import { useNavigate } from 'react-router';
import { BoxInput } from '../style/FileUploadPage';

const FileUploadPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchToken = async () => {
      if (token) {
        const isValidToken = await verifyToken(token);
        if (!isValidToken) {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    } 
    fetchToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = event.target.files;
      const xmlFiles = Array.from(files).filter(file => file.name.endsWith('.xml'));
      setSelectedFiles(xmlFiles);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length > 0 && !uploading) {
      setUploading(true);

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      try {

        await axios.post(`${API_URL}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        console.log('Arquivos enviados com sucesso!');
      } catch (error) {
        console.error('Erro ao enviar arquivos:', error);
      } finally {
        setUploading(false);

        // Agora, configuramos um timeout de 1 segundo antes de permitir a próxima solicitação
        setTimeout(() => {
          // O timeout expirou, permitindo a próxima solicitação
        }, 100);
      }
    } else {
      console.error('Nenhum arquivo .xml selecionado ou upload em andamento.');
    }
  };

  return (
    <div>
      <Header />
      <Container>
        <BoxInput>
          <input type="file" id="fileInput"  className="inputfile" onChange={handleFileChange} multiple accept=".xml" />
          <label htmlFor="fileInput" className="custom-file-upload">Escolha um arquivo</label>
          <button onClick={handleUpload} disabled={uploading}>
            Enviar Arquivos .xml
          </button>
        </BoxInput>
      </Container>
    </div>
  );
};

export default FileUploadPage;

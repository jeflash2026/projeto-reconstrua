// ─────────────────────────────────────────────────────────────────────────────
// MIGRAÇÃO PULSETEST → PAINEL JURÍDICO (2026-08-08, executar UMA vez):
//   docker compose --env-file .env -f docker-compose.production.yml \
//     exec -T api node < /opt/reconstrua/scripts/migracao-pulsetest.mjs
//
// Dados extraídos tela a tela do "Contratos Advocacia"
// (pulsetest.clsolucoes.com) com a sessão do dono: 16 clientes, 43 processos
// (65 contratos), 93 guias e 1 perícia. Autor de tudo: "Migração".
// GUARDA: se o painel já tiver cliente cadastrado, ABORTA (não duplica).
// ─────────────────────────────────────────────────────────────────────────────

const CLIENTES = [
  { pulse: 2, nome: 'IRANITE BRITO DONINI', sexo: 'Feminino', cpfCnpj: '080.810.868-97', rg: '20355689-6', orgaoEmissor: 'SSP/SP', telefone: '(17) 99280-9134', celular1: '(17) 98121-9214', endereco: { logradouro: 'Rua Buritama', numero: '2341', bairro: 'Eldorado', cep: '15043-350', cidade: 'São Jose do Rio Preto', uf: 'SP' } },
  { pulse: 3, nome: 'EDNA LUCIA MELHORATO DA SILVA', sexo: 'Feminino', rg: '261753058', orgaoEmissor: 'SSP/SP', ufEmissao: 'SP', telefone: '(18) 99625-4392', endereco: { logradouro: 'Rua Altino Arantes', numero: '1620', bairro: 'Centro', cep: '15260-000', cidade: 'Planalto', uf: 'SP' } },
  { pulse: 6, nome: 'ELIAS FIRMINO DE LIMA', cpfCnpj: '051.033.318-45', rg: '166922924', orgaoEmissor: 'SSP/SP', endereco: { logradouro: 'Rua dos Driussi', numero: '107', bairro: 'J.D Vanessa', cep: '15970-000', cidade: 'Santa Ernertisna', uf: 'SP' } },
  { pulse: 7, nome: 'IZETE MARQUES DE MELO BRONZATTI', sexo: 'Feminino', cpfCnpj: '018.701.728-09', rg: '8822822-8', orgaoEmissor: 'SSP/SP', telefone: '(17) 99164-5594', endereco: { logradouro: 'Rua André Giantomassi', numero: '5099', bairro: 'Centro', cep: '15350-000', cidade: 'Auriflama', uf: 'SP' } },
  { pulse: 8, nome: 'FLAVIA APARECIDA LIMA RODRIGUES', sexo: 'Feminino', cpfCnpj: '286.762.418-56', rg: '354977064', orgaoEmissor: 'SSP/SP', telefone: '(18) 99819-9877', endereco: { logradouro: 'Rua dos Miosotis', numero: '215', bairro: 'J.d Campos Verdes', cep: '16360-000' } },
  { pulse: 9, nome: 'NIVALDO GONÇALVES GOMES', sexo: 'Masculino', cpfCnpj: '214.837.794-91', rg: '15982767-X', orgaoEmissor: 'SSP/SP', endereco: { logradouro: 'Rua dos Sinibaldi', numero: '22', bairro: 'J. Vanessa', cep: '15970-000' } },
  { pulse: 10, nome: 'FRANCINETE NOGUEIRA DE QUEIROZ GUEDE', sexo: 'Feminino', cpfCnpj: '025.924.798-31', rg: '189734723', orgaoEmissor: 'SSP/SP', telefone: '(17) 99104-0328', endereco: { logradouro: 'Av. Fortunado Ernesto Vetorazzo', numero: '4598', cep: '15130-000', cidade: 'Mirassol', uf: 'SP' } },
  { pulse: 11, nome: 'ORLANDO DOMINGUES DA CUNHA', observacoes: 'Registro duplicado vindo do sistema antigo (sem documento).' },
  { pulse: 12, nome: 'ORLANDO DOMINGUES DA CUNHA', cpfCnpj: '350.381.878-20', rg: '5964990-2', endereco: { logradouro: 'Rua Capitão Vicente Gonçalves', numero: '467', bairro: 'Centro', cep: '15280-000', cidade: 'Turiuba', uf: 'SP' } },
  { pulse: 13, nome: 'MARIA APARECIDA MARTINS DE ATTAIDE VICENTE', sexo: 'Masculino', cpfCnpj: '366.234.151-49', rg: '317626', orgaoEmissor: 'SSP/SP', endereco: { logradouro: 'Rua Alagoas', numero: '4075', bairro: 'Vila Hécilia', cep: '15505-169', cidade: 'Votuporanga', uf: 'SP' } },
  { pulse: 14, nome: 'Sirlei Dornellas Nogara', cpfCnpj: '033.883.728-02', rg: '173652566', orgaoEmissor: 'SSP/SP', telefone: '(18) 99630-4646', endereco: { logradouro: 'Rua Porangaba', numero: '683', bairro: 'Vila Industrial', cep: '16072-165', cidade: 'Araçatuba', uf: 'SP' } },
  { pulse: 15, nome: 'Hildebrando José Marques', sexo: 'Masculino', cpfCnpj: '523.237.658-68', rg: '39703964', endereco: { logradouro: 'Rua Walter Sternieri', numero: '402', bairro: 'P.q Nova Esperança', cep: '15047-371', cidade: 'São Jose do Rio Preto', uf: 'SP' } },
  { pulse: 16, nome: 'Lucia Helena Dias', cpfCnpj: '137.086.158-32', rg: '23713365-9', orgaoEmissor: 'SSP/SP', telefone: '(17) 99768-1009', endereco: { logradouro: 'Rua Samuel de Almeida', numero: '373', bairro: 'Coab 4', cep: '15290-000', cidade: 'Buritama', uf: 'SP' } },
  { pulse: 17, nome: 'Natalia Aparecida de Oliveira', sexo: 'Feminino', cpfCnpj: '036.645.528-14', rg: '12251516-X', orgaoEmissor: 'SSP/SP', endereco: { logradouro: 'Av. Rui Barbosa', numero: '1402', bairro: 'Centro', cep: '15260-000', cidade: 'Planalto', uf: 'SP' } },
  { pulse: 18, nome: 'Francinete Nogueira de Queiróz Guedes', sexo: 'Feminino', cpfCnpj: '025.924.738-31', rg: '189734723', orgaoEmissor: 'SSP/SP', telefone: '(17) 99104-0328', endereco: { logradouro: 'Av F. Ernesto', numero: '4598', bairro: 'Aeroporto', cep: '15130-000', cidade: 'Mirassol', uf: 'SP' } },
  { pulse: 19, nome: 'Cristina Callo da Silva Girotto', sexo: 'Feminino', cpfCnpj: '060.422.098-76', rg: '17618688-8', orgaoEmissor: 'SSP/SP', telefone: '(17) 98141-3709', endereco: { logradouro: 'R. Dr. Luiz Garcia de Figueiredo', numero: '1510', bairro: 'Conj. Hab Floriano Rissi', cep: '15130-000', cidade: 'Mirassol', uf: 'SP' } },
];

const b = (banco, ...contratos) => ({ banco, contratos: contratos.map(([numero, valor]) => ({ numero, valor: valor ?? '' })) });
const PROCESSOS = [
  { pulse: 12, numero: '0000534-95.2010.8.26.0097', bancos: [b('Banco do Brasil S/A', ['150078731', 'R$ 719,46'])] },
  { pulse: 16, numero: '1000872-03.2020.8.26.0097', bancos: [b('Banco Safra S/A', ['000009160199', 'R$ 222,40'], ['000010802225', 'R$ 222,40'], ['00005754959', 'R$ 222,40'])] },
  { pulse: 7, numero: '1001004-69.2023.8.26.0060', bancos: [b('Banco Itaú Consignado S.A.', ['560363805', 'R$ 614,41'], ['566466131', 'R$ 614,41'])] },
  { pulse: 8, numero: '1002007-94.2020.8.26.0438', bancos: [b('Banco Bradesco Financiamento S/A', ['812337235', 'R$ 89,71'])] },
  { pulse: 3, numero: '1002129-58.2023.8.26.0097', bancos: [b('Banco Bradesco Financiamentos S/A', ['806068135', 'R$ 44,41'])] },
  { pulse: 3, numero: '1002130-43.2023.8.26.0097', bancos: [b('Banco Safra S/A', ['000007405972', 'R$ 200,26'])] },
  { pulse: 3, numero: '1002131-28.2023.8.26.0097', bancos: [b('Itaú Unibanco S/A', ['620542210', 'R$ 52,25'])] },
  { pulse: 3, numero: '1002132-13.2023.8.26.0097', bancos: [b('BANCO C6 CONSIGNADO S.A.', ['010001971246', 'R$ 26,42'])] },
  { pulse: 3, numero: '1002344-34.2023.8.26.0097', bancos: [b('Banco Pan S/A', ['0229012112130', 'R$ 39,40'])] },
  { pulse: 17, numero: '1002659-28.2024.8.26.0097', bancos: [b('Banco Pan S/A', ['346999793-1', 'R$ 794,70'])] },
  { pulse: 6, numero: '1003069-38.2025.8.26.0619', bancos: [b('Banco C6 Consignado S.A.', ['010119028916', 'R$ 2.646,00'])] },
  { pulse: 6, numero: '1003070-23.2025.8.26.0619', bancos: [b('Banco Santander (Brasil) S/A', ['873701123-2', 'R$ 75,90'])] },
  { pulse: 6, numero: '1003072-90.2025.8.26.0619', bancos: [b('BANCO DAYCOVAL S.A.', ['53-1455104/22', 'R$ 75,90'])] },
  { pulse: 3, numero: '1003243-95.2024.8.26.0097', bancos: [b('Banco Bradesco Financiamento S/A', ['815691140']), b('Banco C6 S/A', ['010018914575']), b('Banco Pan S/A', ['764271008-6']), b('Bnpp - Banco Bnp Paribas Brasil S.a.', ['22-822203257/17']), b('Itaú Unibanco S/A', ['633050221'])] },
  { pulse: 3, numero: '1003244-80.2024.8.26.0097', bancos: [b('Banco Bradesco Financiamento S/A', ['592175030']), b('Bnpp - Banco Bnp Paribas Brasil S.a.', ['51-829585910/18']), b('Itaú Unibanco S/A', ['636549905'])] },
  { pulse: 3, numero: '1003247-35.2024.8.26.0097', bancos: [b('Bnpp - Banco Bnp Paribas Brasil S.a.', ['22-732817/13310'], ['742241130'], ['Banco Bradesco Financiamento S/A'])] },
  { pulse: 3, numero: '1003253-42.2024.8.26.0097', bancos: [b('Banco Bnp Paribas Brasil S/A', ['22-429439/15310']), b('Banco Bradesco Financiamentos S/A', ['804143988'])] },
  { pulse: 3, numero: '1003536-65.2024.8.26.0097', bancos: [b('Banco Bradesco Financiamentos S/A', ['0123323503645'], ['0123323503969'], ['0123323975218'], ['0123324201834']), b('Banco Pan S/A', ['0229014507284'], ['310976672-9']), b('Banco Safra S/A', ['000015285614'], ['000015666921'], ['000090044393']), b('Banco Santander (Brasil) S/A', ['188311738'], ['228690742']), b('Itaú Unibanco S/A', ['46998181/11999'])] },
  { pulse: 3, numero: '1003540-10.2021.8.26.0097', bancos: [b('BANCO ITAU CONSIGNADO S.A.', ['592811100', 'R$ 471,09'])] },
  { pulse: 3, numero: '1003542-77.2021.8.26.0097', bancos: [b('Banco Bradesco Financiamento S/A', ['810473752', 'R$ 1.580,79'])] },
  { pulse: 3, numero: '1003543-62.2021.8.26.0097', bancos: [b('Banco Safra S/A', ['000090012190', 'R$ 5.561,43'])] },
  { pulse: 3, numero: '1003546-17.2021.8.26.0097', bancos: [b('Banco Pan S/A', ['0229014928948', 'R$ 1.171,25'])] },
  { pulse: 18, numero: '1005086-25.2023.8.26.0358', bancos: [b('Itaú Unibanco S/A', ['638203930', 'R$ 24,00'])] },
  { pulse: 14, numero: '1005995-12.2022.8.26.0032', bancos: [b('Banco BNP Paribas Brasil S/A - BNPP', ['51-836082044/19'])] },
  { pulse: 13, numero: '1007236-60.2025.8.26.0664', bancos: [b('BANCO C6 CONSIGNADO S.A.', ['010017139882', 'R$ 28,20'], ['010115656302', 'R$ 28,20'])] },
  { pulse: 15, numero: '1008641-62.2024.8.26.0084', bancos: [b('Banco Agibank S.A.', ['1516062016', 'R$ 2.084,99'])] },
  { pulse: 10, numero: '1013658-86.2024.8.26.0405', bancos: [b('BANCO BRADESCO FINANCIAMENTOS S/A.', ['337411898-6', 'R$ 1.747,20'])] },
  { pulse: 2, numero: '1027784-86.2024.8.26.0003', bancos: [b('Banco Itau Consignado S.A.', ['545955922', 'R$ 2.910,59'])] },
  { pulse: 2, numero: '1034983-62.2024.8.26.0003', bancos: [b('Banco Itau Consignado S.A.', ['47330598', 'R$ 1.280,69'])] },
  { pulse: 2, numero: '1035493-73.2022.8.26.0576', bancos: [b('Banco do Estado do Rio Grande do Sul S.a.', ['08326779', 'R$ 7.352,64'])] },
  { pulse: 2, numero: '1044377-23.2024.8.26.0576', bancos: [b('Banco do Estado do Rio Grande do Sul - Banrisul', ['08326827', 'R$ 2.532,43'])] },
  { pulse: 2, numero: '1044379-90.2024.8.26.0576', bancos: [b('BANCO ITAU CONSIGNADO S.A.', ['557604583', 'R$ 605,31'])] },
  { pulse: 3, numero: '1102769-60.2023.8.26.0100', bancos: [b('BANCO C6 CONSIGNADO S.A.', ['010013563551'])] },
  { pulse: 3, numero: '1102791-21.2023.8.26.0100', bancos: [b('Itaú Unibanco S/A', ['559734623'])] },
  { pulse: 3, numero: '1102842-32.2023.8.26.0100', bancos: [b('BANCO SAFRA S.A.', ['000007686044', 'R$ 200,26'])] },
  { pulse: 3, numero: '1102863-08.2023.8.26.0100', bancos: [b('Banco C6 Consignado S/A', ['010013658598', 'R$ 49,64'])] },
  { pulse: 19, numero: '1155986-81.2024.8.26.0100', bancos: [b('BANCO SAFRA S/A', ['000003510622', 'R$ 741,68'])] },
  { pulse: 2, numero: '1157020-91.2024.8.26.0100', bancos: [b('Banco BMG S.A.', ['11503293', 'R$ 58,25'])] },
  { pulse: 2, numero: '1157021-76.2024.8.26.0100', bancos: [b('BANCO SANTANDER (BRASIL) S.A.', ['154928449', 'R$ 429,81'])] },
  { pulse: 2, numero: '1157022-61.2024.8.26.0100', bancos: [b('Banco do Estado do Rio Grande do Sul S.a - Banrisul', ['08326894', 'R$ 2.430,54'])] },
  { pulse: 9, numero: '4000499-91.2026.8.26.0619', bancos: [b('BANCO DAYCOVAL S.A.', ['55-7540223/20', 'R$ 8.514,59'])] },
];

const g = (processo, nome, valor, mes, advogado = '', andamento = '') => ({ processo, nome, valor, mes, advogado, andamento });
const GUIAS = [
  g('0000217-77.2026.8.26.0084', 'Hildebrando José Marques', 'R$ 10.042,32', 'Janeiro'),
  g('0000903-06.2025.8.26.0084', 'Katia Cristina Queiroz', 'R$ 20.484,34', 'Janeiro'),
  g('1004662-05.2021.8.26.0438', 'Ines Maria Miotti', 'R$ 4.294,87', 'Janeiro'),
  g('1008251-92.2024.8.26.0084', 'Eugenia de Souza Vieira', 'R$ 20.180,00', 'Janeiro'),
  g('1000523-97.2020.8.26.0097', 'Clarice da Silveira Gonçalves', 'R$ 24.310,99', 'Janeiro'),
  g('0005382-86.2021.8.26.0438', 'Aparecida Benedita da Silva', 'R$ 20.156,03', 'Janeiro'),
  g('0000417-50.2023.8.26.0097', 'Quiteria Ferreira dos Reis', 'R$ 47.000,00', 'Janeiro'),
  g('0000530-33.2025.8.26.0097', 'Jose Luiz Queiroz de Oliveira', 'R$ 134.533,07', 'Março', 'Cido'),
  g('1001011-18.2021.8.26.0097', 'Silvia Aparecida Dias', 'R$ 26.034,60', 'Março'),
  g('0000268-93.2026.8.26.0438', 'Manoel Gomes Sobrinho', 'R$ 1.535,18', 'Março'),
  g('0005584-58.2024.8.26.0438', 'Maria Francisca Espanhol', 'R$ 18.073,14', 'Março', 'Cido'),
  g('0001460-32.2024.8.26.0438', 'Armando Martins', 'R$ 25.671,51', 'Março'),
  g('1034028-65.2023.8.26.0100', 'Maria de Lourdes Alcantra da Silva', 'R$ 24.235,18', 'Março'),
  g('1000301-52.2022.8.26.0100', 'Cleuza Ramalheiro Benedito', 'R$ 17.073,83', 'Março'),
  g('0000224-30.2026.8.26.0097', 'Nilza Euzebio', 'R$ 15.627,94', 'Março'),
  g('0001293-49.2023.8.26.0438', 'Aparecida Amaral Lopes', 'R$ 2.384,07', 'Março'),
  g('0017547-03.2025.8.26.0576', 'Ilda Cornachione', 'R$ 15.397,07', 'Março'),
  g('1118246-89.2024.8.26.0100', 'Maria Rocha dos Santos', 'R$ 19.369,78', 'Março'),
  g('0002559-68.2026.8.26.0405', 'Maria Sonia de Lira Marques', 'R$ 17.075,04', 'Março'),
  g('1002340-27.2020.8.26.0218', 'Lindaura Luiz dos Santos Lime', 'R$ 3.305,06', 'Março'),
  g('1104703-53.2023.8.26.0100', 'Cícera Leite da Silva', 'R$ 45.742,99', 'Março'),
  g('0004537-49.2024.8.26.0438', 'Diogo Teruel Simão', 'R$ 33.117,50', 'Março'),
  g('0002478-22.2026.8.26.0405', 'Liberalina Luiza da Silva Santos', 'R$ 22.791,78', 'Março'),
  g('1018027-05.2023.8.26.0003', 'Edna Maria Nogueira', 'R$ 1.506,17', 'Março'),
  g('0005598-42.2024.8.26.0438', 'Maria de Lourdes do Prado Schuenke', 'R$ 60.553,44', 'Março'),
  g('0004802-85.2023.8.26.0438', 'Jose Geraldo Lopes', 'R$ 35.250,51', 'Março', 'Bido'),
  g('1003114-90.2024.8.26.0097', 'Nilza Euzebio', 'R$ 9.494,60', 'Março'),
  g('0000013-40.2026.8.26.0405', 'Cleidemar dos Santos Pereira Strazzeri', 'R$ 14.021,02', 'Março'),
  g('0000028-60.2026.8.26.0097', 'Terezinha Aparecida da Silva Santos', 'R$ 25.975,96', 'Março'),
  g('1115802-20.2023.8.26.0100', 'Edna Mari Nogueira', 'R$ 7.227,43', 'Março'),
  g('1000543-88.2020.8.26.0097', 'Terezinha Aparecida da Silva Santos', 'R$ 25.975,86', 'Março'),
  g('0000151-58.2026.8.26.0097', 'V.F.C', 'R$ 5.169,76', 'Março'),
  g('0001199-23.2024.8.26.0097', 'Maria Angelica Araujo de Carvalho', 'R$ 35.832,85', 'Fevereiro'),
  g('1037412-91.2023.8.26.0405', 'Maria Sonia de Lira Marques', 'R$ 17.075,54', 'Fevereiro'),
  g('0000700-73.2023.8.26.0097', 'Benedito Prandini', 'R$ 4.112,77', 'Fevereiro'),
  g('0004966-26.2025.8.26.0003', 'Carmelino Rodrigues Celis', 'R$ 14.117,62', 'Fevereiro'),
  g('1002620-80.2021.8.26.0438', 'Helena da Silva Paixão', 'R$ 16.542,31', 'Fevereiro'),
  g('1010072-75.2023.8.26.0405', 'Liberalina Luiza da Silva Santos', 'R$ 22.791,78', 'Fevereiro'),
  g('1044379-90.2024.8.26.0576', 'Iranite Brito Donini', 'R$ 3.530,37', 'Fevereiro'),
  g('1009191-96.2024.8.26.0071', 'João Pedro de Oliveira Pereira', 'R$ 2.020,20', 'Fevereiro'),
  g('0000459-41.2026.8.26.0438', 'Marlene Souza Gama', 'R$ 74.570,81', 'Fevereiro'),
  g('0009264-61.2025.8.26.0003', 'Edna Maria Nogueira', 'R$ 12.644,83', 'Fevereiro'),
  g('1204162-91.2024.8.26.0100', 'Maria Rocha dos Santos', 'R$ 4.500,00', 'Fevereiro'),
  g('1036379-72.2022.8.26.0576', 'Sueli Guarnieri da Silva', 'R$ 8.000,00', 'Fevereiro'),
  g('1000075-46.2022.8.26.0068', 'Carlos Toledo', 'R$ 5.000,00', 'Fevereiro'),
  g('0014198-88.2023.8.26.0405', 'Damião Natalino da Rocha', 'R$ 26.737,34', 'Fevereiro'),
  g('1008621-08.2023.8.26.0084', 'Katia Cristina Queiroz', 'R$ 4.000,00', 'Fevereiro'),
  g('1013658-86.2024.8.26.0405', 'Francinete Nogueira de Queiróz Guedes', 'R$ 8.963,27', 'Fevereiro'),
  g('0000070-12.2026.8.26.0097', 'Clarice da Silveira Gonçalves', 'R$ 24.310,99', 'Fevereiro'),
  g('1000167-25.2022.8.26.0003', 'Arnaldo Souza', 'R$ 2.980,00', 'Fevereiro'),
  g('0000003-02.2025.8.26.0382', 'Rafael Rebato Cabral Scarin', 'R$ 19.000,00', 'Fevereiro'),
  g('0000294-81.2025.8.26.0097', 'José Daniel de Paula', 'R$ 21.817,00', 'Novembro'),
  g('0000861-93.2024.8.26.0438', 'Maria Aparecida da Silva Oliveira', 'R$ 23.569,90', 'Novembro'),
  g('1000489-25.2020.8.26.0097', 'Adineia Marcelino', 'R$ 7.019,78', 'Novembro'),
  g('0022824-07.2024.8.26.0100', 'Clementino Leite de Souza', 'R$ 28.959,48', 'Novembro'),
  g('1160509-39.2024.8.26.0100', 'Liberalina Luiza da Silva Santos', 'R$ 16.401,75', 'Novembro'),
  g('0041542-18.2025.8.26.0100', 'Clarice Rosa Rodrigues de Oliveira', 'R$ 5.364,24', 'Novembro'),
  g('0002782-87.2024.8.26.0438', 'Thereza Nunes Teixeira da Silva', 'R$ 35.530,33', 'Novembro'),
  g('0014254-53.2025.8.26.0405', 'Gildazio Feitosa Sousa', 'R$ 2.857,77', 'Novembro'),
  g('0008343-05.2025.8.26.0100', 'Gildazio Feitosa Sousa', 'R$ 14.861,00', 'Novembro'),
  g('0000088-22.2025.8.26.0306', 'José Irineu dos Santos', 'R$ 43.507,93', 'Novembro'),
  g('1000714-45.2020.8.26.0097', 'Pedro Miguel Ricci', 'R$ 2.050,39', 'Novembro'),
  g('0000538-81.2023.8.26.0484', 'Eder Sabino de Azevedo', 'R$ 850,00', 'Novembro'),
  g('1171116-48.2023.8.26.0100', 'Maria Sonia de Lira Marques', 'R$ 10.175,04', 'Novembro'),
  g('1001898-80.2020.8.26.0438', 'Tereza Rosa Maria Pinheiro Pardim da Silva', 'R$ 6.000,00', 'Novembro'),
  g('0006976-46.2020.8.26.0576', 'J.B.O. J.H.O. J.R.O', 'R$ 45.370,45', 'Novembro', '', 'Acordo'),
  g('0046096-93.2025.8.26.0100', 'Cleidemar dos Santos Pereira Strazzeri', 'R$ 11.557,47', 'Novembro'),
  g('0000483-59.2025.8.26.0097', 'Valdemir Campezzi', 'R$ 22.303,95', 'Novembro'),
  g('0000017-36.2023.8.26.0097', 'Renan Gonçalves Antunes', 'R$ 1.457,33', 'Novembro'),
  g('0011920-46.2025.8.26.0405', 'Maria Sonia de Lira Marques', 'R$ 15.975,85', 'Novembro'),
  g('0038422-98.2024.8.26.0100', 'Maria de Lourdes Alcantra da Silva', 'R$ 4.077,45', 'Novembro'),
  g('1090609-66.2024.8.26.0100', 'Mercedes Passolongo Nogueira', 'R$ 3.600,00', 'Novembro'),
  g('0006175-54.2023.8.26.0438', 'Junia Cristiane Moreira de Souza', 'R$ 1.980,90', 'Novembro'),
  g('1002764-05.2024.8.26.0097', 'Josefina Pires Ferreira', 'R$ 3.331,13', 'Novembro'),
  g('0012121-07.2024.8.26.0071', 'Dalva Quintiliano', 'R$ 33.929,13', 'Janeiro', '', 'Nenhum'),
  g('0000951-57.2024.8.26.0097', 'Pedro Miguel Ricci', 'R$ 27.325,55', 'Janeiro', '', 'Nenhum'),
  g('1001815-64.2020.8.26.0438', 'Maria Aparecida da Silva Oliveira', 'R$ 21.076,40', 'Janeiro', '', 'Nenhum'),
  g('0022128-34.2025.8.26.0100', 'Cleuza Ramalheiro Benedito', 'R$ 16.292,95', 'Janeiro', '', 'Nenhum'),
  g('1000717-97.2020.8.26.0097', 'Quiteria Ferreira dos Reis', 'R$ 44.750,94', 'Janeiro', '', 'Nenhum'),
  g('0000304-28.2025.8.26.0097', 'Adineia Marcelino', 'R$ 6.327,78', 'Dezembro', '', 'Nenhum'),
  g('0004440-58.2025.8.26.0068', 'Luiz Aparecido Ferreira da Silva', 'R$ 32.314,60', 'Dezembro', '', 'Nenhum'),
  g('0020937-51.2025.8.26.0100', 'Dimeria Brito de Almeida Ramalheiro', 'R$ 1.550,33', 'Dezembro', '', 'Nenhum'),
  g('0004309-84.2025.8.26.0003', 'Cícera Leite da Silva', 'R$ 658,95', 'Dezembro', '', 'Nenhum'),
  g('0000673-16.2024.8.26.0369', 'Osorio Nogueira', 'R$ 23.988,34', 'Dezembro', '', 'Nenhum'),
  g('1037845-04.2022.8.26.0576', 'Carlos Alberto da Costa', 'R$ 10.000,00', 'Dezembro', '', 'Nenhum'),
  g('0004601-68.2025.8.26.0068', 'Maria de Lourdes Alcantra da Silva', 'R$ 16.542,31', 'Dezembro', '', 'Nenhum'),
  g('1001813-94.2020.8.26.0438', 'Junia Cristiane Moreira de Souza', 'R$ 1.980,90', 'Dezembro', '', 'Nenhum'),
  g('0000582-73.2025.8.26.0438', 'Helena da Silva Paixão', 'R$ 16.542,31', 'Dezembro', '', 'Nenhum'),
  g('0001257-89.2025.8.26.0097', 'Francisca Brito da Costa', 'R$ 23.239,29', 'Dezembro', '', 'Nenhum'),
  g('0001256-07.2025.8.26.0097', 'Sonia Marli Basso Miahara', 'R$ 37.677,18', 'Dezembro'),
  g('1001911-79.2020.8.26.0438', 'Valdelice Muniz da Silva', 'R$ 17.187,83', 'Dezembro'),
  g('0000916-88.2010.8.26.0097', 'Jose de Freitas Brito', 'R$ 5.750,00', 'Dezembro'),
  g('1016731-69.2022.8.26.0071', 'Esmeria Alves Cardoso da Silva', 'R$ 5.000,00', 'Dezembro'),
];

const PERICIAS = [
  {
    processo: '1104340-66.2023.8.26.0100',
    requerente: 'Carlos Zanini',
    requerido: 'Banco Intermedium S/A',
    data: '2026-06-01',
    horario: '14:00',
    local: 'Foro Central Cível - 25ª',
    situacao: 'agendada',
  },
];

(async () => {
  const port = process.env.ADMIN_PORT || 3102;
  const token = process.env.ADMIN_ACCESS_SECRET || '';
  const AUTOR = 'Migração';
  const chamar = async (rota, corpo) => {
    const res = await fetch(`http://localhost:${port}/admin/juridico/${rota}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...corpo, autor: AUTOR }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  // GUARDA anti-duplicação: painel precisa estar VAZIO de clientes.
  const atual = await fetch(`http://localhost:${port}/admin/juridico/dashboard`, {
    headers: { authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  if ((atual.clientes ?? 0) > 0) {
    console.log(`ABORTADO: o painel já tem ${atual.clientes} cliente(s) — a migração só roda em painel vazio (evita duplicar).`);
    return;
  }

  console.log('1/4 clientes…');
  const mapa = new Map();
  for (const c of CLIENTES) {
    const { pulse, ...dados } = c;
    const r = await chamar('clientes', { dados });
    if (!r.ok || typeof r.data.valor !== 'string') {
      console.log(`  FALHA cliente ${c.nome}:`, r.data);
      continue;
    }
    mapa.set(pulse, r.data.valor);
    console.log(`  ✓ ${c.nome}`);
  }

  console.log('2/4 processos…');
  let contratos = 0;
  for (const p of PROCESSOS) {
    const clienteId = mapa.get(p.pulse);
    if (clienteId === undefined) {
      console.log(`  PULO processo ${p.numero}: cliente pulse=${p.pulse} não migrado`);
      continue;
    }
    const r = await chamar('processos', {
      dados: { clienteId, numero: p.numero, status: 'ativo', bancos: p.bancos },
    });
    if (!r.ok) console.log(`  FALHA processo ${p.numero}:`, r.data);
    else {
      contratos += p.bancos.reduce((s, x) => s + x.contratos.length, 0);
      console.log(`  ✓ ${p.numero}`);
    }
  }

  console.log('3/4 guias…');
  let guiasOk = 0;
  for (const dados of GUIAS) {
    const r = await chamar('guias', { dados });
    if (!r.ok) console.log(`  FALHA guia ${dados.processo}:`, r.data);
    else guiasOk += 1;
  }

  console.log('4/4 perícias…');
  for (const dados of PERICIAS) {
    const r = await chamar('pericias', { dados });
    console.log(r.ok ? `  ✓ ${dados.requerente}` : `  FALHA perícia:`, r.ok ? '' : r.data);
  }

  console.log('');
  console.log(`MIGRAÇÃO CONCLUÍDA: ${mapa.size}/16 clientes · ${contratos}/65 contratos · ${guiasOk}/93 guias · ${PERICIAS.length} perícia.`);
})();

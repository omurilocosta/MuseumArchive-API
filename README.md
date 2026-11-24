# MuseumArchive API

API REST para gerenciamento do acervo do Museu Nacional de História Natural e Arqueologia.

## 1. Tecnologias escolhidas

- **Banco de dados NoSQL:** MongoDB
- **Runtime:** Node.js (18 ou superior)
- **Framework HTTP:** Express 4
- **ODM:** Mongoose 8
- **Configuração de ambiente:** dotenv
- **Testes manuais de API:** Postman ou `curl`

A escolha do MongoDB atende aos requisitos específicos de persistência de laudos com `$push` e `$slice` e de relatório analítico com Aggregation Framework e `$facet`.

## 2. Pré-requisitos

- Node.js 18+
- npm
- MongoDB local ou uma instância MongoDB Atlas

## 3. Instalação e execução

```bash
npm install
```

Copie `.env.example` para `.env` e ajuste a conexão:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/museumarchive
```

Inicie em desenvolvimento:

```bash
npm run dev
```

Ou em execução normal:

```bash
npm start
```

Verifique a aplicação em `GET http://localhost:3000/health`.

## 4. Organização do projeto

```text
MuseumArchive/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── models/
│   │   ├── artefatoModel.js
│   │   └── curadorModel.js
│   ├── repositories/
│   │   └── acervoRepository.js
│   ├── services/
│   │   ├── acervoService.js
│   │   └── erros.js
│   ├── controllers/
│   │   ├── acervoController.js
│   │   └── asyncHandler.js
│   ├── routes/
│   │   └── acervoRoutes.js
│   ├── middlewares/
│   │   └── errorHandler.js
│   └── server.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 5. Modelagem persistida

### Artefato

O documento `Artefato` contém `numeroTombamento`, `titulo`, `tipoItem`, `dataAquisicao`, `statusAtual`, `responsavelId`, `especificidades`, `laudosRestauracao` e `movimentacoes`.

- `responsavelId` é uma referência `ObjectId` para a coleção `curadores`.
- `especificidades` é um subdocumento embutido.
- `laudosRestauracao` e `movimentacoes` são arrays de subdocumentos embutidos.
- Os subdocumentos não recebem `_id` próprio, preservando a estrutura definida no diagrama.

### Curador

O documento `Curador` fica na coleção `curadores` e contém `nome`, `matricula` e `departamento`, além do `_id` gerado pelo MongoDB.

### Polimorfismo e integridade de especificidades

Os campos aceitos em `especificidades` dependem de `tipoItem`:

| `tipoItem` | Campos aceitos |
|---|---|
| `Paleontologia` | `eraGeologica`, `formacaoRochosa` |
| `Arqueologia` | `sitioEscavacao`, `culturaAssociada` |
| `Pintura` | `tecnica`, `suporte` |

A API rejeita propriedades pertencentes a outra categoria ou propriedades desconhecidas. Os campos estão definidos como opcionais no diagrama original; por isso, a implementação não inventa obrigatoriedade individual para cada especificidade.

## 6. Máquina de estados

Todo artefato é cadastrado com `statusAtual: "EmReservaTecnica"`. O cliente não pode definir nem alterar diretamente o status pelo cadastro ou pela rota de atualização comum.

As únicas transições aceitas são:

| Estado atual | Ação enviada | Novo estado |
|---|---|---|
| `EmReservaTecnica` | `AGENDAR_EXIBICAO` | `EmExposicao` |
| `EmExposicao` | `FIM_EXIBICAO` | `EmReservaTecnica` |
| `EmReservaTecnica` | `CONCEDER_EMPRESTIMO` | `EmEmprestimo` |
| `EmEmprestimo` | `DEVOLUCAO` | `EmReservaTecnica` |
| `EmReservaTecnica` | `IDENTIFICAR_DANOS` | `EmAnaliseRestauracao` |
| `EmAnaliseRestauracao` | `APROVAR_LAUDO` | `EmProcessoRestauracao` |
| `EmProcessoRestauracao` | `CONCLUIR_RESTAURACAO` | `EmReservaTecnica` |

Transições não listadas retornam HTTP `400 Bad Request`. A atualização do status usa uma condição pelo status anterior no próprio comando de atualização, evitando que duas requisições concorrentes sobrescrevam silenciosamente uma à outra; se o estado tiver mudado entre a leitura e a atualização, a API retorna `409 Conflict`.

## 7. Limite dos laudos

A inclusão usa a operação MongoDB `$push` com `$each` e `$slice: -5`. Assim, o documento mantém somente os cinco laudos mais recentes, descartando o mais antigo quando um novo laudo excede o limite.

## 8. Relatório analítico

`GET /api/relatorios/acervo?dias=30` usa o Aggregation Framework com `$facet` e retorna:

- `contagemPorTipo`: quantidade de artefatos agrupados por `tipoItem`;
- `artefatosRestauradosRecentemente`: artefatos cujo `dataLaudo` mais recente está dentro do período solicitado.

**Critério de interpretação:** o diagrama não contém um campo específico de data de conclusão da restauração. Portanto, para operacionalizar o relatório sem alterar a modelagem, a implementação utiliza a data do laudo mais recente (`laudosRestauracao.dataLaudo`) como indicador de restauração recente. Essa limitação fica explícita na resposta da API.

O parâmetro `dias` é opcional, padrão 30, e aceita inteiros entre 1 e 3650.

## 9. Endpoints

Base URL local: `http://localhost:3000/api`

### Curadores

| Método | Caminho | Descrição |
|---|---|---|
| `POST` | `/curadores` | Cadastrar curador |
| `GET` | `/curadores` | Listar curadores |
| `GET` | `/curadores/:id` | Consultar curador |
| `PUT` | `/curadores/:id` | Atualizar curador |
| `DELETE` | `/curadores/:id` | Excluir curador sem artefatos vinculados |

Exemplo de cadastro:

```json
{
  "nome": "Ana Souza",
  "matricula": "CUR-001",
  "departamento": "Paleontologia"
}
```

### Artefatos

| Método | Caminho | Descrição |
|---|---|---|
| `POST` | `/artefatos` | Cadastrar artefato |
| `GET` | `/artefatos` | Listar; filtros opcionais `tipoItem`, `statusAtual`, `responsavelId` |
| `GET` | `/artefatos/:id` | Consultar artefato |
| `PATCH` | `/artefatos/:id` | Atualizar dados, sem alterar status diretamente |
| `DELETE` | `/artefatos/:id` | Excluir artefato |
| `POST` | `/artefatos/:id/laudos` | Acrescentar laudo (mantém os cinco últimos) |
| `POST` | `/artefatos/:id/movimentacoes` | Registrar movimentação |
| `PATCH` | `/artefatos/:id/transicoes` | Executar uma transição permitida |
| `GET` | `/relatorios/acervo` | Relatório analítico com `$facet` |

Exemplo de artefato paleontológico:

```json
{
  "numeroTombamento": "MNHA-001",
  "titulo": "Fóssil de referência",
  "tipoItem": "Paleontologia",
  "dataAquisicao": "2024-03-15T00:00:00.000Z",
  "responsavelId": "COLE_AQUI_O_OBJECTID_DO_CURADOR",
  "especificidades": {
    "eraGeologica": "Jurássico",
    "formacaoRochosa": "Formação Exemplo"
  }
}
```

O status inicial é atribuído pelo servidor. Não é necessário enviá-lo.

Exemplo de laudo:

```json
{
  "dataLaudo": "2026-01-20T00:00:00.000Z",
  "restaurador": "Carlos Lima",
  "procedimentoRealizado": "Limpeza mecânica controlada",
  "observacoes": "Sem danos adicionais identificados"
}
```

Exemplo de movimentação:

```json
{
  "origem": "Reserva técnica A",
  "destino": "Galeria 2",
  "dataMovimento": "2026-02-01T10:00:00.000Z",
  "responsavelTransporte": "Equipe de acervo"
}
```

Exemplo de transição:

```json
{
  "acao": "AGENDAR_EXIBICAO"
}
```

## 10. Respostas de erro

O middleware centraliza os erros:

- `400`: validação, formato inválido ou transição de estado não permitida;
- `404`: artefato, curador ou rota não encontrada;
- `409`: tombamento/matrícula duplicados, curador vinculado a artefatos ou conflito de concorrência;
- `500`: erro interno não previsto.

Formato de exemplo:

```json
{
  "erro": true,
  "mensagem": "Transição não permitida: DEVOLUCAO não pode ser executada quando o artefato está em EmExposicao."
}
```

## 11. Observações de escopo

- Os nomes dos endpoints foram definidos como uma interface REST coerente porque o enunciado fornecido especifica as funcionalidades, mas não fixa URLs ou verbos HTTP.
- A API não cria uma coleção separada para `Especificidades`, `LaudoRestauracao` ou `Movimentacao`.
- Não foi adicionada autenticação, autorização ou paginação porque esses requisitos não constam da especificação recebida.
- O arquivo `.env` não deve ser versionado. Use `.env.example` como modelo.

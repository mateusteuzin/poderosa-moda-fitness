# TODO - Admin: tirar foto no celular no upload de imagens

- [x] Revisar e ajustar `admin.html`:
  - [x] Remover/ocultar o input único atual de imagens
  - [x] Criar input escondido para galeria (accept="image/*", multiple)
  - [x] Criar input escondido para câmera (accept="image/*", capture="environment")
  - [x] Adicionar 2 botões estilizados: “Escolher da galeria” e “Tirar foto”
  - [x] Adicionar favicon no admin.html se estiver faltando


- [x] Revisar e ajustar `admin.js`:
  - [x] Bind do `change` dos 2 inputs (galeria e câmera) em um handler comum
  - [x] Garantir que preview/reordenação/remover continuam funcionando
  - [x] Garantir upload reaproveita a função atual `uploadProductImages`


- [x] Ajustar `admin.css`:
  - [x] Criar estilos para os botões do uploader no mobile (tamanho grande e responsivo)


- [ ] Testes:

  - [ ] Android: “Tirar foto” abre câmera (capture="environment") e cria preview
  - [ ] iPhone: verificar comportamento (quando capture não suportado, deve abrir seletor)
  - [ ] Desktop: “Escolher da galeria” abre seletor normal
  - [ ] Remover imagem e salvar produto
  - [ ] Validar tipos (JPG/PNG/WEBP) e tamanho


# Soccer Pro (HTML5 Canvas)

Um jogo de futebol 2D feito em HTML/CSS/JS puro — com IA simples, físicas, animações, HUD e suporte a **desktop e mobile**.

## Recursos
- Partida 5x5 (4 jogadores de linha + goleiro) com IA ajustável.
- Físicas simples da bola, colisões e chute/passe.
- Goleiros com posicionamento básico.
- Partículas (chute e confete do gol), sombras e brilho.
- Placar, cronômetro e telas de início/pausa/gol/ajuda/opções.
- Controles de **teclado** (WASD/Setas, Shift, Espaço, Q) e **touch** (joystick + botões).
- Sem bibliotecas externas. Ideal para **GitHub Pages**.

## Como jogar (desktop)
- **Mover:** WASD ou setas.
- **Correr:** Shift (consome fôlego).
- **Chutar/Passar:** Espaço.
- **Trocar jogador:** Q (seleciona o mais próximo da bola).
- **Pausar:** Esc.

## Como publicar no GitHub Pages
1. Crie um repositório **público** no GitHub (ex.: `soccer-pro`).
2. Envie estes arquivos para a raiz do repositório.
3. Em **Settings → Pages**, em **Source** selecione **Deploy from a branch**, branch **main** e pasta **/** (root). Salve.
4. A URL do seu jogo aparecerá em **Settings → Pages** após o deploy.

## Estrutura
```
soccer-pro/
├── index.html
├── style.css
├── js/
│   └── game.js
└── README.md
```

## Licença
MIT © 2025

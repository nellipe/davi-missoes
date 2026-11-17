# Three.js local

Three.js 0.180.0, licença MIT (LICENSE). Apenas os módulos ES de produção necessários ao WebGLRenderer. Origem: pacote npm oficial `three@0.180.0` (https://github.com/mrdoob/three.js/tree/r180).

Nenhum CDN, import map remoto, telemetry ou instalação npm é usado em runtime. Modelos, personagens e cenários são originais, construídos como malhas 3D em world3d.js; não há assets de jogos/marcas de terceiros.

Atualização deliberada: obter o pacote em pasta temporária de ferramentas, copiar build/three.module.min.js, build/three.core.min.js e LICENSE, repetir tests/browser_realms.cjs. A aplicação segue executando com Python e navegador, sem build Node.

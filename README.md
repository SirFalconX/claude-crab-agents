# 🦀 crab-agents

Un mod para Claude Code que muestra el trabajo de los agentes como una familia de cangrejos Claude en pixel-art.

- **Uso restante (arriba del panel)**: barras retro de lo que queda de la sesión (5 h), la semana y Fable, con cuándo se reinicia cada una. Los bloques que se pierden estallan en píxeles.
- **Árbol de agentes (panel lateral "🦀 Agentes")**: crece hacia abajo, una fila por agente, cada subagente colgando de quien lo lanzó con un conector de su color. Cada cangrejo se anima según su estado: trabajando, esperando, terminado (salta y ✓ verde) o fallido (gris, ojos en X). Los subagentes trabajan con una notebook (tecleando) o con una lupa (los Explore). Claude principal se ve más cansado a medida que se agota el límite semanal.
- **Uso por agente**: encima de cada cangrejo, tokens, costo aproximado y herramientas, con una barra retro y un mini cangrejo.
- **Banda sobre el cuadro de texto**: tiempo restante estimado, porcentaje, tiempo transcurrido y costo, con una barra retro que se llena poco a poco y un cangrejito caminando al frente.

El panel se abre solo cuando Claude lanza el primer subagente de cada trabajo; también con el comando `/cangrejos` o el botón 🦀 Árbol de la banda.

El costo total del trabajo sale del mismo contador que `/cost`. El de cada agente es una estimación: sus tokens a precios de referencia por familia de modelo, ajustados con ese total.

Las animaciones se ven en la app de escritorio de Claude; en el terminal el mod se dibuja en modo texto.

## Instalación

En el prompt de una sesión de Claude Code en el terminal:

```
/plugin install crab-agents --marketplace SirFalconX/claude-crab-agents
```

Responde `y` para añadir el marketplace y elige el ámbito (scope).

Desde una consola:

```bash
claude plugin install crab-agents --marketplace SirFalconX/claude-crab-agents
```

En la app de escritorio, donde `/plugin` no funciona: pulsa + junto al cuadro de texto, luego Plugins, Add marketplace con `SirFalconX/claude-crab-agents`, y después Add plugin.

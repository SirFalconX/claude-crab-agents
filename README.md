# 🦀 crab-agents

Un mod para Claude Code que muestra el trabajo de los agentes como una familia de cangrejos Claude en pixel-art.

- **Árbol de agentes (panel lateral "🦀 Agentes")**: Claude principal arriba y cada subagente colgando de quien lo lanzó, con su propio color. Cada cangrejo se anima según su estado: trabajando (rebota, mueve patas y pinzas), esperando (respira y mira a los lados), terminado (salta, ojos felices y ✓ verde) o fallido (gris, ojos en X). Debajo, cada agente muestra su tarea, la herramienta que usa ahora, tiempo, costo aproximado y tokens.
- **Banda sobre el cuadro de texto**: barra de progreso con un tramo por agente y un cangrejito que avanza, más `3/5 agentes · ⏱ 1m 05s · ~$0.42` y la actividad actual.

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

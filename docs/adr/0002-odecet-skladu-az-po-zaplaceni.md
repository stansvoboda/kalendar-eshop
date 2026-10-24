# Odečet skladu až po zaplacení, bez rezervace

Při vzniku platebního pokusu se jen kontroluje, že je dost kusů skladem; odečtou se až při vzniku objednávky. Rezervace kusů na dobu platebního pokusu (Stripe ho drží otevřený nejméně 30 minut) by vyžadovala uvolňování propadlých rezervací a byla pro cvičný projekt zbytečně složitá. Cenou je vzácný přeprodej: počet kusů klesne pod nulu, obchod dostane upozornění a rozhodne o stornu.

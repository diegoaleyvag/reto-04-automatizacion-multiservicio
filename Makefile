.DEFAULT_GOAL := ayuda
.NOTPARALLEL:
SHELL := /bin/sh
COMPOSE ?= docker compose
RESPALDO ?=
RESTAURAR ?=

.PHONY: ayuda iniciar detener estado registros construir probar sembrar respaldar verificar-respaldo restaurar

ayuda:
	@printf '%s\n' 'Reto 04 · Sebastián y Santiago' 'make iniciar              Construye e inicia los cuatro servicios' 'make detener              Detiene sin borrar los datos' 'make estado               Muestra los servicios y su salud' 'make registros            Muestra los últimos registros' 'make construir            Construye las imágenes de la aplicación' 'make probar               Ejecuta las pruebas funcionales reales' 'make sembrar              Agrega los datos iniciales sin duplicarlos' 'make respaldar            Genera SQL y manifiesto de ambos motores' 'make verificar-respaldo   Restaura el respaldo en bases temporales' 'make restaurar RESTAURAR=SI RESPALDO=respaldos/carpeta' '                          Reemplaza los datos actuales con un respaldo' 'Variables: COMPOSE, APP_PORT, RESPALDO y RESTAURAR'

iniciar:
	$(COMPOSE) up --build -d --wait --wait-timeout 180

detener:
	$(COMPOSE) down

estado:
	$(COMPOSE) ps

registros:
	$(COMPOSE) logs --tail=80

construir:
	$(COMPOSE) build

probar:
	$(COMPOSE) exec -T backend npm test

sembrar:
	$(COMPOSE) exec -T backend npm run seed

respaldar:
	COMPOSE='$(COMPOSE)' sh scripts/respaldar.sh

verificar-respaldo:
	COMPOSE='$(COMPOSE)' RESPALDO='$(RESPALDO)' sh scripts/verificar-respaldo.sh

restaurar:
	COMPOSE='$(COMPOSE)' RESPALDO='$(RESPALDO)' RESTAURAR='$(RESTAURAR)' sh scripts/restaurar.sh

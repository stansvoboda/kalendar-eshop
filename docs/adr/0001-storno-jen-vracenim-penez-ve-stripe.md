# Storno jen vrácením peněz ve Stripe

Objednávka se stane Stornovanou jedině vrácením celé částky ve Stripe; webhook pak stav nastaví a pošle kupujícímu e-mail. Ve Studiu Stornovanou nastavit nejde. Kdyby šlo stornovat na obou místech, mohl by stav tvrdit „stornováno“, i když peníze vráceny nebyly (nebo naopak). Částečné vrácení stav nemění.

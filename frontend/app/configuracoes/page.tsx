"use client";

import { useState } from "react";
import { User, Bell, Shield, Palette, Save } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-gate";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("perfil");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const initials = user?.initials || "?";
  const name = user?.name || "Utilizador";
  const level = user?.level ?? 1;
  const coins = user?.coins ?? 0;
  const email = user?.email || "";

  return (
    <div className="space-y-8">
      <PageHeader title="Configurações" description="Personaliza a tua experiência na plataforma EYK.">
        <Button onClick={save} className="gap-2">
          <Save className="h-4 w-4" />
          {saved ? "Guardado ✓" : "Guardar alterações"}
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-surface">
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2">
            <Bell className="h-4 w-4" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2">
            <Shield className="h-4 w-4" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="gap-2">
            <Palette className="h-4 w-4" /> Aparência
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="perfil" className="space-y-5">
            <Card className="p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <Avatar className="h-24 w-24 shadow-md">
                  <AvatarFallback className="text-3xl bg-gradient-gold text-primary-foreground font-serif font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <p className="font-serif text-2xl font-semibold">{name}</p>
                  <Badge variant="outline" className="text-xs">
                    Nível {level} · {coins} moedas
                  </Badge>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm">Alterar foto</Button>
                    <Button variant="outline" size="sm">Remover foto</Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-soft grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" defaultValue={name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={email} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bio">Biografia</Label>
                <Input id="bio" defaultValue={user?.bio || ""} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notificacoes" className="space-y-5">
            <Card className="p-6 shadow-soft divide-y">
              {[
                { k: "email-comunidade", l: "Emails da comunidade", d: "Recebe emails quando alguém interage com os teus posts." },
                { k: "email-cursos", l: "Novos módulos de cursos", d: "Avisa quando um curso inscrito tem novo conteúdo." },
                { k: "push-gamificacao", l: "Notificações push de gamificação", d: "Conquistas, moedas e lembretes de streak." },
                { k: "email-semanal", l: "Resumo semanal", d: "Email semanal com o teu progresso e destaques." },
              ].map((row) => (
                <div key={row.k} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{row.l}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{row.d}</p>
                  </div>
                  <Switch defaultChecked={!row.k.includes("semanal")} />
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="seguranca" className="space-y-5">
            <Card className="p-6 shadow-soft grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="senha-atual">Palavra-passe atual</Label>
                <PasswordInput id="senha-atual" defaultValue="********" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha-nova">Nova palavra-passe</Label>
                <PasswordInput id="senha-nova" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha-confirmar">Confirmar nova</Label>
                <PasswordInput id="senha-confirmar" />
              </div>
            </Card>
            <Card className="p-6 shadow-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium">Autenticação de dois fatores (2FA)</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Camada extra de segurança ao entrares na tua conta.
                </p>
              </div>
              <Badge variant="outline" className="w-fit">Desativado</Badge>
            </Card>
          </TabsContent>

          <TabsContent value="aparencia" className="space-y-5">
            <Card className="p-6 shadow-soft divide-y">
              {[
                { k: "tema", l: "Modo escuro automático", d: "Ajusta automaticamente conforme a hora do dia." },
                { k: "animacoes", l: "Animações", d: "Ativa transições e micro-interações na interface." },
                { k: "diminuir", l: "Reduzir movimento", d: "Minimiza animações para acessibilidade." },
              ].map((row, i) => (
                <div key={row.k} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{row.l}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{row.d}</p>
                  </div>
                  <Switch defaultChecked={i !== 2} />
                </div>
              ))}
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

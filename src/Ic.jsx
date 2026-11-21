import React from "react";
import { Trash2, Pencil, Download, CalendarPlus, Paperclip, FileText, Eye, Brain, MessageCircle, Save, ScanLine, TrendingUp, FlaskConical, X, Menu, Bell, Users, Utensils, Repeat, Gift, Lock, AlertTriangle, Timer, NotebookPen, RefreshCw, Undo2 } from "lucide-react";

/* Icone sottili (solo contorno) al posto delle emoji nei pulsanti e nelle etichette */
const MAPPA = {
  trash: Trash2, edit: Pencil, download: Download, calendar: CalendarPlus, clip: Paperclip, file: FileText, eye: Eye,
  brain: Brain, chat: MessageCircle, save: Save, scan: ScanLine, trend: TrendingUp, flask: FlaskConical, x: X, menu: Menu,
  bell: Bell, users: Users, meal: Utensils, repeat: Repeat, gift: Gift, lock: Lock, warn: AlertTriangle, timer: Timer,
  note: NotebookPen, sync: RefreshCw, undo: Undo2,
};

export default function Ic({ n, size = 14, bare = false }) {
  const C = MAPPA[n];
  if (!C) return null;
  return <C size={size} strokeWidth={1.8} style={{ display: "inline-block", verticalAlign: "-0.15em", marginRight: bare ? 0 : 4, flexShrink: 0 }} aria-hidden="true" />;
}

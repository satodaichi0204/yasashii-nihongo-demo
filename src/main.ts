import "./style.css";
import { mountStudent } from "./student/student";
import { mountApp } from "./teacher/app";

// 「#student」で開いたときは児童向けの画面、それ以外は教師用の画面
const root = document.getElementById("app")!;
if (location.hash.startsWith("#student")) mountStudent(root);
else mountApp(root);

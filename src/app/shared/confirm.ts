export async function confirmUserChange(title: string, text: string) {
  const { default: Swal } = await import("sweetalert2");
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: "بله، ذخیره شود",
    cancelButtonText: "انصراف",
    closeButtonAriaLabel: "بستن تأیید",
    buttonsStyling: false,
    reverseButtons: true,
    focusCancel: true,
    allowOutsideClick: false,
    customClass: {
      popup: "app-confirm",
      confirmButton: "btn btn-primary",
      cancelButton: "btn btn-light",
    },
  });
  return result.isConfirmed;
}

export async function confirmDelete(title: string, text: string) {
  const { default: Swal } = await import("sweetalert2");
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: "بله، حذف شود",
    cancelButtonText: "انصراف",
    closeButtonAriaLabel: "بستن تأیید",
    buttonsStyling: false,
    reverseButtons: true,
    focusCancel: true,
    allowOutsideClick: false,
    customClass: {
      popup: "app-confirm",
      confirmButton: "btn btn-danger",
      cancelButton: "btn btn-light",
    },
  });
  return result.isConfirmed;
}
export async function requestReason(title:string) {
  const {default:Swal}=await import('sweetalert2');
  const result=await Swal.fire({title,input:'textarea',inputLabel:'دلیل عملیات',showCancelButton:true,confirmButtonText:'تأیید و ثبت',cancelButtonText:'انصراف',inputValidator:value=>value.trim()?undefined:'دلیل را وارد کنید.',customClass:{popup:'app-confirm'},focusCancel:true});
  return result.isConfirmed ? String(result.value).trim() : null;
}

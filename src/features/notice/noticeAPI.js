import { setNoticeList } from "./noticeSlice";
// shared
import { api } from "shared/lib/axios";

export const setNoticeListAPI = () => async(dispatch) => {
    const result = await api.get("/notice/all");
    dispatch(setNoticeList({"result" : result.data}));
}